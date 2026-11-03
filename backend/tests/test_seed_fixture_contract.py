import json
import os
import pytest

def test_seed_fixture_exists_and_is_valid_json():
    """Verify backend/fixtures/seed_data.json exists and is valid JSON."""
    fixture_path = "backend/fixtures/seed_data.json"
    assert os.path.exists(fixture_path), f"Fixture file not found: {fixture_path}"

    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert isinstance(data, dict)
    assert data.get("version") == "1.0.0"

def test_seed_fixture_has_all_required_domains():
    """Verify fixture contains all essential domain collections."""
    fixture_path = "backend/fixtures/seed_data.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    required_keys = [
        "user",
        "leads",
        "recentCalls",
        "incomingCalls",
        "dailyTasks",
        "calendarInvites",
        "calendarCollaborators",
        "pulseChannels",
        "pulseThreads",
        "notifications",
        "chartData",
        "agentRoles",
        "sellingPersonas",
    ]

    for key in required_keys:
        assert key in data, f"Missing key in seed_data.json: {key}"

    # Verify user profile
    user = data["user"]
    assert user["name"] == "Arvind Rajan"
    assert user["store"] == "Koramangala"
    assert user["brand"] == "The Sleep Company"
    assert user["ogScore"] == 76

    # Verify leads
    assert len(data["leads"]) >= 5
    for lead in data["leads"]:
        assert "id" in lead
        assert "name" in lead
        assert "phone" in lead
        assert "interest" in lead
        assert "product" in lead
        assert "buyingSignals" in lead

    # Verify pulse threads
    for ch in data["pulseChannels"]:
        assert ch["id"] in data["pulseThreads"], f"Channel {ch['id']} has no thread definition"
