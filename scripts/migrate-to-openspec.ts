/**
 * GitHub Issue/PR 迁移到 OpenSpec 文档的转换脚本
 * 
 * 用途：将项目历史上通过 GitHub Issue + PR 记录的需求和变更转换为 OpenSpec 格式
 * 
 * OpenSpec 规范约束：
 * - Change name 只能包含 lowercase letters, numbers, and hyphens
 * - proposal.md: Why, What Changes, Capabilities, Impact
 * - design.md: Context, Goals/Non-Goals, Decisions, Risks
 * - tasks.md: 编号分组格式
 * 
 * 运行方式：pnpm tsx scripts/migrate-to-openspec.ts [--dry-run] [--status=archived|active]
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// 类型定义
interface GitHubIssue {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  body: string;
  createdAt: string;
  closedAt: string | null;
  labels: Array<{ name: string }>;
}

interface GitHubPR {
  number: number;
  title: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  body: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  labels: Array<{ name: string }>;
}

interface ChangeRecord {
  name: string;
  issue?: GitHubIssue;
  pr?: GitHubPR;
  status: 'archived' | 'active';
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'chore';
}

/**
 * 将标题转换为符合 OpenSpec 规范的目录名
 * 规范：只能包含 lowercase letters, numbers, and hyphens
 */
function titleToKebabName(title: string, number: number, isIssue: boolean): string {
  // 移除前缀标签 (feat:, fix:, refactor:, docs:, chore:, style:, test:)
  let cleanTitle = title
    .replace(/^(feat|fix|refactor|docs|chore|style|test)\s*:?/i, '')
    .replace(/\(.*?\):?\s*/g, '')
    .trim();

  // 提取英文单词
  const englishWords = cleanTitle.match(/[a-zA-Z]+/g) || [];
  
  // 如果有足够的英文关键词（至少2个），使用英文
  if (englishWords.length >= 2) {
    return englishWords.slice(0, 4).join('-').toLowerCase();
  }
  
  // 如果只有1个英文单词，结合类型
  if (englishWords.length === 1) {
    const prefix = isIssue ? 'issue' : 'pr';
    return prefix + '-' + number + '-' + englishWords[0].toLowerCase();
  }
  
  // 如果主要是中文或其他语言，使用 issue-N 或 pr-N 格式
  return isIssue ? 'issue-' + number : 'pr-' + number;
}

// 从标题推断变更类型
function inferCategory(title: string, labels: Array<{ name: string }>): ChangeRecord['category'] {
  const labelNames = labels.map(l => l.name.toLowerCase());
  if (labelNames.includes('bug')) return 'bugfix';
  if (labelNames.includes('enhancement')) return 'feature';
  
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.startsWith('fix') || lowerTitle.includes('修复')) return 'bugfix';
  if (lowerTitle.startsWith('feat') || lowerTitle.includes('新增') || lowerTitle.includes('添加')) return 'feature';
  if (lowerTitle.startsWith('refactor') || lowerTitle.includes('重构') || lowerTitle.includes('迁移')) return 'refactor';
  if (lowerTitle.startsWith('docs') || lowerTitle.includes('文档')) return 'docs';
  return 'feature';
}

// 检查是否为 Dependabot PR
function isDependabotPR(pr: GitHubPR): boolean {
  return pr.title.includes('chore(deps') || pr.title.includes('bump ');
}

// 获取 GitHub 数据
function fetchGitHubData() {
  console.log('正在获取 GitHub Issue 数据...');
  const issuesJson = execSync(
    'gh issue list --limit 100 --state all --json number,title,state,body,createdAt,closedAt,labels',
    { encoding: 'utf-8' }
  );
  const issues: GitHubIssue[] = JSON.parse(issuesJson);

  console.log('正在获取 GitHub PR 数据...');
  const prsJson = execSync(
    'gh pr list --limit 100 --state all --json number,title,state,body,createdAt,closedAt,mergedAt,labels',
    { encoding: 'utf-8' }
  );
  const prs: GitHubPR[] = JSON.parse(prsJson);

  return { issues, prs };
}

// 分析 Issue 和 PR 的对应关系
function analyzeRecords(issues: GitHubIssue[], prs: GitHubPR[]): ChangeRecord[] {
  const records: ChangeRecord[] = [];
  const usedIssues = new Set<number>();
  const usedPRs = new Set<number>();

  // 1. 匹配有 Closes #xxx 的 PR
  for (const pr of prs) {
    if (isDependabotPR(pr)) {
      console.log('跳过 Dependabot PR #' + pr.number + ': ' + pr.title);
      continue;
    }

    const closesMatch = pr.title.match(/Closes\s+#(\d+)/i) || pr.body?.match(/Closes\s+#(\d+)/i);
    if (closesMatch) {
      const issueNumber = parseInt(closesMatch[1]);
      const issue = issues.find(i => i.number === issueNumber);
      
      if (issue) {
        usedIssues.add(issue.number);
        usedPRs.add(pr.number);
        
        const status = pr.state === 'MERGED' ? 'archived' : 'active';
        const name = titleToKebabName(issue.title, issue.number, true);
        
        records.push({ name, issue, pr, status, category: inferCategory(pr.title, pr.labels) });
      }
    }
  }

  // 2. 处理没有对应 Issue 的 PR
  for (const pr of prs) {
    if (usedPRs.has(pr.number) || isDependabotPR(pr)) continue;
    
    usedPRs.add(pr.number);
    const status = pr.state === 'MERGED' ? 'archived' : 'active';
    const name = titleToKebabName(pr.title, pr.number, false);
    
    records.push({ name, pr, status, category: inferCategory(pr.title, pr.labels) });
  }

  // 3. 处理没有对应 PR 的 Issue
  for (const issue of issues) {
    if (usedIssues.has(issue.number)) continue;
    
    const status = issue.state === 'CLOSED' ? 'archived' : 'active';
    const name = titleToKebabName(issue.title, issue.number, true);
    
    records.push({ name, issue, status, category: inferCategory(issue.title, issue.labels) });
  }

  return records;
}

// 生成 proposal.md 内容
function generateProposal(record: ChangeRecord): string {
  const source = record.issue || record.pr!;
  const title = record.issue?.title || record.pr?.title || '';
  
  let content = '# 提案：' + title + '\n\n';
  content += '## Why\n\n';
  content += '此变更记录从 GitHub 迁移而来。\n\n';
  if (record.issue) content += '- **GitHub Issue**: #' + record.issue.number + '\n';
  if (record.pr) content += '- **GitHub PR**: #' + record.pr.number + '\n';
  content += '\n';
  if (source.body) content += '**原始需求：**\n\n' + source.body + '\n\n';
  
  content += '## What Changes\n\n';
  content += '详见设计文档。\n\n';
  
  content += '## Capabilities\n\n';
  content += '### New Capabilities\n\n';
  content += '- 功能实现\n\n';
  content += '### Modified Capabilities\n\n';
  content += '- 相关模块改进\n\n';
  
  content += '## Impact\n\n';
  content += '- 状态：' + (record.status === 'archived' ? '已完成归档' : '进行中') + '\n';
  
  return content;
}

// 生成 design.md 内容
function generateDesign(record: ChangeRecord): string {
  const title = record.issue?.title || record.pr?.title || '';
  
  let content = '# 技术设计：' + title + '\n\n';
  content += '## Context\n\n';
  content += '此设计文档从 GitHub 迁移而来。\n\n';
  
  if (record.pr?.body) {
    const summaryMatch = record.pr.body.match(/## Summary\n([\s\S]*?)(?=##|$)/i);
    if (summaryMatch) content += '**实现概述：**\n\n' + summaryMatch[1].trim() + '\n\n';
  }
  
  content += '## Goals\n\n';
  content += '- 完成功能需求\n- 保证代码质量\n- 更新文档\n\n';
  
  content += '## Non-Goals\n\n';
  content += '- 不引入不相关变更\n- 不破坏现有功能\n\n';
  
  content += '## Decisions\n\n';
  content += '遵循项目规范实现。\n\n';
  
  content += '## Risks / Trade-offs\n\n';
  content += '- 需要充分测试验证\n';
  
  return content;
}

// 生成 tasks.md 内容
function generateTasks(record: ChangeRecord): string {
  let content = '# 任务列表\n\n';
  
  if (record.status === 'archived') {
    content += '> 此变更已完成并归档。\n\n';
    content += '## 1. 实现任务\n\n';
    content += '- [x] 1.1 分析需求\n';
    content += '- [x] 1.2 设计方案\n';
    content += '- [x] 1.3 实现功能\n';
    content += '- [x] 1.4 编写测试\n';
    content += '- [x] 1.5 更新文档\n';
  } else {
    content += '## 1. 待办任务\n\n';
    content += '- [ ] 1.1 分析需求\n';
    content += '- [ ] 1.2 设计方案\n';
    content += '- [ ] 1.3 实现功能\n';
    content += '- [ ] 1.4 编写测试\n';
    content += '- [ ] 1.5 更新文档\n';
  }
  
  return content;
}

// 创建 OpenSpec 变更
function createOpenSpecChange(record: ChangeRecord, dryRun: boolean = false) {
  const targetDir = record.status === 'archived' ? 'openspec/changes/archive' : 'openspec/changes';
  const changePath = path.join(targetDir, record.name);
  
  console.log('\n处理变更: ' + record.name);
  console.log('  状态: ' + record.status);
  console.log('  目标路径: ' + changePath);
  
  if (dryRun) {
    console.log('  [DRY RUN] 将创建文件');
    return;
  }
  
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    if (!fs.existsSync(changePath)) fs.mkdirSync(changePath, { recursive: true });
    
    const openspecYaml = 'schema: spec-driven\nname: ' + record.name + '\nstatus: ' + record.status + '\ncategory: ' + record.category + '\n';
    fs.writeFileSync(path.join(changePath, '.openspec.yaml'), openspecYaml);
    fs.writeFileSync(path.join(changePath, 'proposal.md'), generateProposal(record));
    fs.writeFileSync(path.join(changePath, 'design.md'), generateDesign(record));
    fs.writeFileSync(path.join(changePath, 'tasks.md'), generateTasks(record));
    
    console.log('  ✓ 已创建变更文档');
  } catch (error) {
    console.error('  ✗ 创建失败: ' + error);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const statusFilter = args.find(a => a.startsWith('--status='))?.split('=')[1];
  
  console.log('========================================');
  console.log('GitHub Issue/PR → OpenSpec 迁移工具');
  console.log('========================================\n');
  
  if (dryRun) console.log('[DRY RUN 模式]\n');
  
  const { issues, prs } = fetchGitHubData();
  console.log('获取到 ' + issues.length + ' 个 Issue, ' + prs.length + ' 个 PR\n');
  
  const records = analyzeRecords(issues, prs);
  const archived = records.filter(r => r.status === 'archived');
  const active = records.filter(r => r.status === 'active');
  
  console.log('\n统计信息:');
  console.log('  已归档变更: ' + archived.length);
  console.log('  活跃变更: ' + active.length);
  
  const toProcess = statusFilter ? records.filter(r => r.status === statusFilter) : records;
  console.log('\n将处理 ' + toProcess.length + ' 条记录...\n');
  
  for (const record of toProcess) {
    createOpenSpecChange(record, dryRun);
  }
  
  console.log('\n========================================');
  console.log('迁移完成！');
  console.log('========================================');
}

main().catch(console.error);
