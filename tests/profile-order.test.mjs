import assert from "node:assert/strict";
import test from "node:test";

import { isAvailabilityLine } from "../app/availability.js";
import {
  countExpertsWithAvailability,
  reorderAvailabilityLines,
} from "../app/profile-order.js";

test("moves bottom availability directly below a recommended expert title", () => {
  const source = [
    "Scheduler Link: Book Now",
    "Project page: access these profiles online",
    "Excel download: view project in Excel",
    "",
    "Recommended #1.2 - Deepak Khandelwal - Former COO at DBS Bank",
    "Book Now",
    "This expert is a strong fit for the project.",
    "[Screened on Oct 8]",
    "Q1. What changes are likely?",
    "A1. Core systems will become more AI-native.",
    "",
    "Availability (SGT):",
    "• Thursday 08 October 3:00 PM - 6:30 PM",
    "• Friday 09 October 9:00 AM - 12:00 PM",
  ].join("\n");

  const reordered = reorderAvailabilityLines(source).split("\n");
  const titleIndex = reordered.indexOf("Recommended #1.2 - Deepak Khandelwal - Former COO at DBS Bank");

  assert.deepEqual(reordered.slice(0, 3), [
    "Scheduler Link: Book Now",
    "Project page: access these profiles online",
    "Excel download: view project in Excel",
  ]);
  assert.equal(reordered[titleIndex + 1], "Book Now");
  assert.equal(reordered[titleIndex + 2], "Availability (SGT):");
  assert.equal(reordered[titleIndex + 3], "• Thursday 08 October 3:00 PM - 6:30 PM");
  assert.ok(reordered.indexOf("This expert is a strong fit for the project.") > titleIndex + 3);
});

test("keeps each expert's availability with the correct expert", () => {
  const source = [
    "#1.1 - First Expert",
    "First RE",
    "Monday 12 October 9:00 AM - 10:00 AM",
    "#1.2 - Second Expert",
    "Second RE",
    "No availability has been provided.",
  ].join("\n");

  const reordered = reorderAvailabilityLines(source).split("\n");
  assert.deepEqual(reordered.slice(0, 2), [
    "#1.1 - First Expert",
    "Monday 12 October 9:00 AM - 10:00 AM",
  ]);
  const second = reordered.indexOf("#1.2 - Second Expert");
  assert.equal(reordered[second + 1], "No availability has been provided.");
  assert.deepEqual(countExpertsWithAvailability(source), { experts: 2, withAvailability: 2 });
});

test("reports expert profiles that have no availability", () => {
  const source = [
    "#1.1 - First Expert",
    "First RE",
    "Tuesday 13 October 10:00 AM - 11:00 AM",
    "#1.2 - Second Expert",
    "Second RE",
  ].join("\n");

  assert.deepEqual(countExpertsWithAvailability(source), { experts: 2, withAvailability: 1 });
});

test("recognizes availability lines copied with a plain-text bullet", () => {
  assert.equal(isAvailabilityLine("• Thursday 08 October 3:00 PM - 6:30 PM"), true);
  assert.equal(isAvailabilityLine("- Friday 09 October 9:00 AM - 12:00 PM"), true);
});
