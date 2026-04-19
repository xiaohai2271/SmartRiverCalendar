# 技术设计

## 概述

此设计文档从 GitHub PR #14 迁移而来。

## 设计细节

**之前**:
\\\
前端 Store → database.ts → @tauri-apps/plugin-sql → SQLite
\\\

**现在**:
\\\
前端 Store → invoke() → Rust 后端 → SQLite
\\\

