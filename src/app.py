"""Static web app for a six-game digital bingo card."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="One Card Bingo",
    description="A mobile-friendly digital bingo card for up to six games.",
)

app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent / "static"),
    name="static",
)


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")
