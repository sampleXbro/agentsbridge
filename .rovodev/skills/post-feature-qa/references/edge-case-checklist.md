# Edge Case Checklist — Reference

When reviewing tests for a feature, systematically check these categories. Not all apply to every feature; use judgment.

## Input Validation (APIs, Schemas, Config)

| Category         | Examples                         | Test pattern                                   |
| ---------------- | -------------------------------- | ---------------------------------------------- |
| Missing required | `undefined`, omitted key         | `parse({})` → throws / returns error           |
| Wrong type       | `string` where `number` expected | `parse({ x: "1" })` → throws                   |
| Null             | `null` for required field        | `parse({ x: null })` → throws                  |
| Empty string     | `""` where non-empty required    | `parse({ x: "" })` → throws                    |
| Empty array      | `[]` (valid or invalid?)         | Explicit test                                  |
| Invalid element  | Array of wrong type              | `parse({ arr: [123] })` where strings expected |
| Invalid enum     | Value not in allowed set         | `parse({ target: "invalid" })` → throws        |
| Nested structure | Wrong shape inside object        | `parse({ mcp: { wrongKey: "x" } })`            |
| Extra keys       | Unknown top-level keys           | Warning vs error, test behavior                |

## Boundaries

| Scenario         | When relevant          | Test                 |
| ---------------- | ---------------------- | -------------------- |
| Empty collection | Arrays, lists          | `[]`                 |
| Single element   | Collections            | `[x]`                |
| Max length       | If spec defines limits | At limit, over limit |
| Zero, negative   | Numbers                | If applicable        |

## Error Handling

| Scenario             | Test                                              |
| -------------------- | ------------------------------------------------- | -------------------------------------- |
| Error message format | Assert message contains field path, expected type |
| Multiple errors      | Input with several invalid fields → all reported  |
| Line hints           | If spec mentions "line X"                         | Test with getLineForPath or equivalent |

## Optional vs Required

| Scenario              | Test                                          |
| --------------------- | --------------------------------------------- |
| All optional omitted  | Minimal valid input                           |
| Each optional present | Full valid input                              |
| Defaults applied      | Omit optional, assert default value in output |

## Story-Specific

If the story or task explicitly says:

- "every field type" → One invalid-type test per field
- "missing file" → Test for absence (or document as loader responsibility)
- "unknown keys" → Test that unknown keys don't fail, and warning helper exists
- "line hint" → Test error formatter with line callback

Check the story's task list and test requirements line by line.
