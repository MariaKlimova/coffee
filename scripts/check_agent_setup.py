"""Проверка общего inventory навыков и ссылок Codex/Cursor без зависимостей."""

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit


def check_links(path: Path, root: Path) -> list[str]:
    """Проверить локальные Markdown-ссылки, исключая примеры в fenced code."""
    content = re.sub(r"(?ms)^```.*?^```[^\n]*", "", path.read_text())
    errors = []
    for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", content):
        target = target.strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        resolved = (path.parent / unquote(parsed.path)).resolve()
        if not resolved.is_relative_to(root):
            errors.append(f"{path.relative_to(root)}: ссылка вне repo: {target}")
        elif not resolved.exists():
            errors.append(f"{path.relative_to(root)}: нет цели ссылки: {target}")
    return errors


def check_setup(root: Path) -> tuple[list[str], int]:
    """Сверить реальные папки Cursor, ссылки Codex и базовую metadata skills."""
    root = root.resolve()
    cursor = root / ".cursor/skills"
    codex = root / ".agents/skills"
    errors = []
    for directory in (cursor, codex):
        if not directory.is_dir() or directory.is_symlink():
            errors.append(f"Нужен настоящий каталог {directory.relative_to(root)}")
    if errors:
        return errors, 0

    sources = {p.name: p for p in cursor.iterdir() if p.is_dir() or p.is_symlink()}
    mirrors = {p.name: p for p in codex.iterdir() if p.is_dir() or p.is_symlink()}
    if not sources:
        errors.append("Не найдены проектные skills")
    for name in sorted(sources.keys() - mirrors.keys()):
        errors.append(f"Нет подключения Codex: {name}")
    for name in sorted(mirrors.keys() - sources.keys()):
        errors.append(f"Лишнее/сломанное подключение Codex: {name}")

    for name, source in sorted(sources.items()):
        if source.is_symlink():
            errors.append(f"Источник Cursor должен быть реальной папкой: {name}")
            continue
        mirror = mirrors.get(name)
        if mirror is not None:
            if not mirror.is_symlink():
                errors.append(f"Codex требует ссылку, не копию: {name}")
            elif mirror.readlink() != Path(f"../../.cursor/skills/{name}"):
                errors.append(f"Неверная относительная ссылка Codex: {name}")
            elif mirror.resolve() != source.resolve():
                errors.append(f"Codex/Cursor указывают на разные файлы: {name}")

        entry = source / "SKILL.md"
        if not entry.is_file():
            errors.append(f"Нет SKILL.md: {name}")
            continue
        content = entry.read_text()
        frontmatter = re.match(r"\A---\n(.*?)\n---(?:\n|$)", content, re.S)
        if frontmatter is None:
            errors.append(f"Нет frontmatter: {name}")
            continue
        metadata = frontmatter.group(1)
        skill_name = re.search(r"^name: *([a-z0-9]+(?:-[a-z0-9]+)*) *$", metadata, re.M)
        description = re.search(r"^description: *(.+(?:\n[ \t]+[^\n]+)*)", metadata, re.M)
        if skill_name is None or skill_name.group(1) != name or len(name) > 64:
            errors.append(f"Имя skill должно совпадать с папкой: {name}")
        if description is None or not description.group(1).strip(" \n\"'>-|"):
            errors.append(f"Нет содержательного description: {name}")

        # Проверить ссылки через исходную папку и discovery-путь Codex.
        for folder in (source, mirror):
            if folder is not None and folder.is_dir():
                for path in folder.rglob("*.md"):
                    errors.extend(check_links(path, root))

    for path in (root / ".cursor/agents").glob("*.md"):
        errors.extend(check_links(path, root))
    for relative in ("AGENTS.md", ".cursor/BUGBOT.md", "README.md"):
        path = root / relative
        if path.is_file():
            errors.extend(check_links(path, root))
    return errors, len(sources)


def main() -> int:
    """Запустить проверку из любого рабочего каталога."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors, count = check_setup(args.root)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"OK: {count} skills доступны Codex и Cursor; локальные ссылки проверены")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
