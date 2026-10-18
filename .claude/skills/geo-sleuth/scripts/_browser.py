"""Shared Chrome / Playwright Chromium launch and actionable setup errors."""
from __future__ import annotations

import os

from _net import resolve_proxy


async def launch_browser(playwright, proxy: str | None = None):
    value = resolve_proxy(proxy)
    options = {"headless": True, "timeout": 15000,
               "args": ["--disable-blink-features=AutomationControlled"]}
    if value:
        options["proxy"] = {"server": value.replace("socks5h://", "socks5://")}
    else:
        options["args"].append("--no-proxy-server")
    errors = []
    attempts = [("Google Chrome", {"channel": "chrome"}), ("Playwright Chromium", {})]
    # GEO_CHROMIUM: a preinstalled Chromium binary (e.g. /opt/pw-browsers/chromium) to try last.
    if os.environ.get("GEO_CHROMIUM"):
        attempts.append(("Chromium (GEO_CHROMIUM)", {"executable_path": os.environ["GEO_CHROMIUM"]}))
    for name, extra in attempts:
        try:
            browser = await playwright.chromium.launch(**extra, **options)
            return browser, name
        except Exception as exc:
            errors.append(f"{name}: {str(exc).splitlines()[0]}")
    raise RuntimeError(
        "Neither Google Chrome nor Playwright Chromium could start. "
        "Run `uvx playwright install chromium` and retry; on Linux, missing system libraries "
        "may require `uvx playwright install --with-deps chromium`. "
        + " | ".join(errors))
