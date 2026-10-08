import assert from "node:assert/strict";
import test from "node:test";

import { isAvailabilityLine } from "../app/availability.js";
import {
  countExpertsWithAvailability,
  reorderAvailabilityLines,
} from "../app/profile-order.js";

test("places a title and availability summary above the project links", () => {
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
  const title = "Recommended #1.2 - Deepak Khandelwal - Former COO at DBS Bank";
  const summaryTitleIndex = reordered.indexOf(title);
  const projectLinksIndex = reordered.indexOf("Scheduler Link: Book Now");
  const profileTitleIndex = reordered.lastIndexOf(title);

  assert.ok(summaryTitleIndex < projectLinksIndex);
  assert.equal(reordered[summaryTitleIndex + 1], "Availability (SGT):");
  assert.equal(reordered[summaryTitleIndex + 2], "• Thursday 08 October 3:00 PM - 6:30 PM");
  assert.ok(profileTitleIndex > projectLinksIndex);
  assert.equal(reordered[profileTitleIndex + 1], "Book Now");
  assert.ok(reordered.indexOf("This expert is a strong fit for the project.") > profileTitleIndex);
  assert.equal(reordered.filter((line) => line === "Availability (SGT):").length, 1);
  assert.equal(reordered.filter((line) => line.includes("Thursday 08 October")).length, 1);
});

test("keeps each expert's availability with the correct expert without project links", () => {
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

test("builds multiple expert summaries before project links", () => {
  const source = [
    "Introductory email text",
    "To manage this project, select profiles or schedule calls, please use the following links:",
    "View project online",
    "View project in Excel",
    "",
    "#1.1 - First Expert",
    "First RE",
    "Monday 12 October 9:00 AM - 10:00 AM",
    "#1.2 - Second Expert",
    "Second RE",
    "Tuesday 13 October 10:00 AM - 11:00 AM",
  ].join("\n");

  const reordered = reorderAvailabilityLines(source).split("\n");
  const linksIndex = reordered.indexOf("To manage this project, select profiles or schedule calls, please use the following links:");
  assert.deepEqual(reordered.slice(0, 6), [
    "Introductory email text",
    "#1.1 - First Expert",
    "Monday 12 October 9:00 AM - 10:00 AM",
    "",
    "#1.2 - Second Expert",
    "Tuesday 13 October 10:00 AM - 11:00 AM",
  ]);
  assert.ok(linksIndex > 5);
  assert.equal(reordered.filter((line) => line.includes("Monday 12 October")).length, 1);
  assert.equal(reordered.filter((line) => line.includes("Tuesday 13 October")).length, 1);
  assert.ok(reordered.lastIndexOf("#1.2 - Second Expert") > linksIndex);
});

test("does not duplicate a summary that is already above the project links", () => {
  const source = [
    "#1.1 - First Expert",
    "Monday 12 October 9:00 AM - 10:00 AM",
    "To manage this project, select profiles or schedule calls, please use the following links:",
    "View project online",
    "#1.1 - First Expert",
    "First RE",
  ].join("\n");

  const reordered = reorderAvailabilityLines(source);
  assert.equal(reordered, source);
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
