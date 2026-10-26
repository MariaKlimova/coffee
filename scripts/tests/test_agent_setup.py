"""Проверки discovery и отсутствия копий/сломанных references на временном repo."""

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "check_agent_setup", Path(__file__).resolve().parents[1] / "check_agent_setup.py"
)
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class AgentSetupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / ".cursor/skills/example"
        self.source.mkdir(parents=True)
        self.codex = self.root / ".agents/skills"
        self.codex.mkdir(parents=True)
        self.mirror = self.codex / "example"
        self.mirror.symlink_to("../../.cursor/skills/example", target_is_directory=True)
        (self.root / "docs").mkdir()
        (self.root / "docs/reference.md").write_text("# Контракт\n")
        (self.source / "SKILL.md").write_text(
            "---\nname: example\ndescription: Проверка примера\n---\n"
            "[Контракт](../../../docs/reference.md)\n"
        )

    def test_shared_skill_and_root_reference_work_from_both_entrypoints(self):
        errors, count = CHECKER.check_setup(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(count, 1)
        self.assertEqual(
            (self.mirror / "SKILL.md").resolve(),
            (self.source / "SKILL.md").resolve(),
        )

    def test_missing_codex_registration_fails(self):
        self.mirror.unlink()
        errors, _ = CHECKER.check_setup(self.root)
        self.assertTrue(any("Нет подключения Codex" in error for error in errors))

    def test_content_copy_is_rejected_even_when_identical(self):
        self.mirror.unlink()
        shutil.copytree(self.source, self.mirror)
        errors, _ = CHECKER.check_setup(self.root)
        self.assertTrue(any("ссылку, не копию" in error for error in errors))

    def test_deleted_reference_fails_for_both_entrypoints(self):
        (self.root / "docs/reference.md").unlink()
        errors, _ = CHECKER.check_setup(self.root)
        self.assertTrue(any(".cursor/skills/example" in error for error in errors))
        self.assertTrue(any(".agents/skills/example" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
