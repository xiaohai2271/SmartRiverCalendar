/**
 * GitHub Issue/PR 迁移到 OpenSpec 文档的转换脚本
 * 
 * 用途：将项目历史上通过 GitHub Issue + PR 记录的需求和变更转换为 OpenSpec 格式
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

// 将标题转换为 slug 名称（保留中文）
function titleToSlug(title: string): string {
  // 移除前缀标签如 "feat:", "fix:", "refactor:" 等
  const cleanTitle = title.replace(/^(feat|fix|refactor|docs|chore|style|test)\s*:?/i, '').trim();
  
  // 将空格替换为连字符，保留中文和其他字符
  // 移除 Windows 文件名非法字符: \ / : * ? " < > |
  return cleanTitle
    .replace(/[:*?"<>|\\\/]/g, '-')  // 替换非法字符为连字符
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
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

  // 1. 匹配有 "Closes #xxx" 的 PR
  for (const pr of prs) {
    if (isDependabotPR(pr)) {
      console.log(`跳过 Dependabot PR #${pr.number}: ${pr.title}`);
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
        const name = `issue-${issue.number}-${titleToSlug(issue.title)}`;
        
        records.push({
          name,
          issue,
          pr,
          status,
          category: inferCategory(pr.title, pr.labels)
        });
      }
    }
  }

  // 2. 处理没有对应 Issue 的 PR
  for (const pr of prs) {
    if (usedPRs.has(pr.number) || isDependabotPR(pr)) continue;
    
    usedPRs.add(pr.number);
    const status = pr.state === 'MERGED' ? 'archived' : 'active';
    const name = `pr-${pr.number}-${titleToSlug(pr.title)}`;
    
    records.push({
      name,
      pr,
      status,
      category: inferCategory(pr.title, pr.labels)
    });
  }

  // 3. 处理没有对应 PR 的 Issue
  for (const issue of issues) {
    if (usedIssues.has(issue.number)) continue;
    
    const status = issue.state === 'CLOSED' ? 'archived' : 'active';
    const name = `issue-${issue.number}-${titleToSlug(issue.title)}`;
    
    records.push({
      name,
      issue,
      status,
      category: inferCategory(issue.title, issue.labels)
    });
  }

  return records;
}

// 生成 proposal.md 内容
function generateProposal(record: ChangeRecord): string {
  const source = record.issue || record.pr!;
  const title = record.issue?.title || record.pr?.title || '';
  
  let content = `# 提案：${title}\n\n`;
  content += `## 来源\n\n`;
  if (record.issue) content += `- GitHub Issue: #${record.issue.number}\n`;
  if (record.pr) content += `- GitHub PR: #${record.pr.number}\n`;
  content += `\n## 背景\n\n`;
  content += `此变更记录从 GitHub 迁移而来，原始创建时间：${source.createdAt}\n\n`;
  content += `## 需求描述\n\n`;
  content += `${source.body || '（无详细描述）'}\n\n`;
  if (record.status === 'archived' && record.pr) {
    content += `## 非目标\n\n此变更已完成并归档。\n\n`;
  }
  return content;
}

// 生成 design.md 内容
function generateDesign(record: ChangeRecord): string {
  if (!record.pr?.body) return `# 技术设计\n\n此变更暂无详细技术设计文档。\n`;
  
  const prBody = record.pr.body;
  let content = `# 技术设计\n\n## 概述\n\n`;
  content += `此设计文档从 GitHub PR #${record.pr.number} 迁移而来。\n\n`;
  
  const summaryMatch = prBody.match(/## Summary\n([\s\S]*?)(?=##|$)/);
  if (summaryMatch) content += `## 实现概述\n\n${summaryMatch[1].trim()}\n\n`;
  
  const designMatch = prBody.match(/## (技术实现|架构变更|关键设计决策)([\s\S]*?)(?=##|$)/i);
  if (designMatch) content += `## 设计细节\n\n${designMatch[2].trim()}\n\n`;
  
  if (!summaryMatch && !designMatch) content += `## 原始描述\n\n${prBody}\n\n`;
  return content;
}

// 生成 tasks.md 内容
function generateTasks(record: ChangeRecord): string {
  let content = `# 任务列表\n\n`;
  if (record.status === 'archived') {
    content += `> 此变更已完成并归档。\n\n## 已完成任务\n\n`;
    content += `- [x] 实现功能需求\n- [x] 编写单元测试\n- [x] 更新相关文档\n`;
  } else {
    content += `## 待办任务\n\n`;
    content += `- [ ] 分析需求细节\n- [ ] 设计技术方案\n- [ ] 实现功能\n- [ ] 编写单元测试\n- [ ] 更新文档\n`;
  }
  
  if (record.pr?.body) {
    const filesMatch = record.pr.body.match(/## Files Changed\n([\s\S]*?)(?=##|$)/i) ||
                       record.pr.body.match(/## 变更文件\n([\s\S]*?)(?=##|$)/i);
    if (filesMatch) content += `\n## 相关文件\n\n${filesMatch[1].trim()}\n`;
  }
  return content;
}

// 创建 OpenSpec 变更
function createOpenSpecChange(record: ChangeRecord, dryRun: boolean = false) {
  const targetDir = record.status === 'archived' 
    ? 'openspec/changes/archive' 
    : 'openspec/changes';
  const changePath = path.join(targetDir, record.name);
  
  console.log(`\n处理变更: ${record.name}`);
  console.log(`  状态: ${record.status}`);
  console.log(`  类型: ${record.category}`);
  console.log(`  目标路径: ${changePath}`);
  
  if (dryRun) {
    console.log(`  [DRY RUN] 将创建以下文件:`);
    console.log(`    - ${changePath}/.openspec.yaml`);
    console.log(`    - ${changePath}/proposal.md`);
    console.log(`    - ${changePath}/design.md`);
    console.log(`    - ${changePath}/tasks.md`);
    return;
  }
  
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    if (!fs.existsSync(changePath)) fs.mkdirSync(changePath, { recursive: true });
    
    const openspecYaml = `schema: spec-driven\nname: ${record.name}\nstatus: ${record.status}\ncategory: ${record.category}\ncreated: ${new Date().toISOString()}\nsource:\n${record.issue ? `  issue: ${record.issue.number}` : ''}\n${record.pr ? `  pr: ${record.pr.number}` : ''}\n`;
    fs.writeFileSync(path.join(changePath, '.openspec.yaml'), openspecYaml);
    fs.writeFileSync(path.join(changePath, 'proposal.md'), generateProposal(record));
    fs.writeFileSync(path.join(changePath, 'design.md'), generateDesign(record));
    fs.writeFileSync(path.join(changePath, 'tasks.md'), generateTasks(record));
    
    console.log(`  ✓ 已创建变更文档`);
  } catch (error) {
    console.error(`  ✗ 创建失败: ${error}`);
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
  
  if (dryRun) console.log('[DRY RUN 模式] 仅显示将执行的操作\n');
  
  const { issues, prs } = fetchGitHubData();
  console.log(`获取到 ${issues.length} 个 Issue, ${prs.length} 个 PR\n`);
  
  const records = analyzeRecords(issues, prs);
  const archived = records.filter(r => r.status === 'archived');
  const active = records.filter(r => r.status === 'active');
  
  console.log('\n统计信息:');
  console.log(`  已归档变更: ${archived.length}`);
  console.log(`  活跃变更: ${active.length}`);
  
  const toProcess = statusFilter 
    ? records.filter(r => r.status === statusFilter)
    : records;
  
  console.log(`\n将处理 ${toProcess.length} 条记录...\n`);
  
  for (const record of toProcess) {
    createOpenSpecChange(record, dryRun);
  }
  
  console.log('\n========================================');
  console.log('迁移完成！');
  console.log('========================================');
}

main().catch(console.error);