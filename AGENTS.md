# medical-system 开发规则

本项目通过 `.ai-workflow` 子模块固定 AI 交付基线 v1.0.0。需要在本地使用模板时，运行 `git submodule update --init`，并使用具备共享仓库读取权限的 GitHub 账号。

- 开始实现前，通过 GitHub Issue 确定范围和验收标准。按需求、设计与拆分、实现、验证、评审与合并、发布与复盘六个阶段，在 `docs/implementation-records/<任务编号>/` 保留独立产物。
- 实现 PR 使用仓库的 PR 模板，链接六阶段产物，在正文填写 `ai-delivery-directory`。本地运行 `python3 scripts/check_delivery.py <产物目录>`。PR 会运行 **Stage artifacts**。
- 项目文档沿用 [文档索引](docs/README-INDEX.md) 的分工，测试入口见 [测试手册](docs/runbooks/testing.md)。合并及发布后补录实际评审、验证和发布记录。
- 更新共享基线时，先暂存更新后的子模块指针，再运行 `python3 .ai-workflow/scripts/sync_ci_snapshot.py`。GitHub Actions 可用与子模块指针对应的校验脚本快照完成检查。
