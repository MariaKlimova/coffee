---
name: coffee-review
description: "Ревью PR, ветки или незакоммиченного diff Coffee по BUGBOT: Django/FSD, API, платежи, copy/tokens, дубли, dead code и SRP. Проверка навыков Codex/Cursor при их изменении; без исправления кода."
---

# Code review Coffee

Прочитать [контракт ревьюера](../../../.cursor/agents/code-review.md),
[BUGBOT](../../../.cursor/BUGBOT.md), `AGENTS.md` и указанный там pre-read.
Применить проходы и полный формат отчёта из контракта, без параллельной копии правил.

Установить base/HEAD и фактический scope: committed diff, staged/unstaged и новые
untracked файлы задачи. Не терять незакоммиченную реализацию при `base...HEAD`.
Отделить чужие изменения и читать контекст/callers для каждого finding.

В `coffee-task` работает отдельный read-only reviewer. При самостоятельном вызове
делегировать только в рамках разрешения пользователя; собственную проверку
не называть независимой. Наличие файла роли не означает запущенный review/Bugbot.

Не менять код, Git или Jira. Возвращать полный отчёт, ограничения проверок и вердикт
`approve` / `request changes`; при blocking — второй вариант. После исправлений
проверить новую ревизию затронутого scope, не переносить старый approve вслепую.
