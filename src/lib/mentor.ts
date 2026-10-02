export type Message = { id: string; role: "mentor" | "student"; content: string };
export type Verification = { passed: boolean; summary: string; checks: string[] };

export const sampleDiagram = `flowchart TD
  A([Receive numbers]) --> B[Create an empty set]
  B --> C{Next number?}
  C -->|Yes| D{Already in set?}
  D -->|Yes| E([Return true])
  D -->|No| F[Add number to set]
  F --> C
  C -->|No| G([Return false])`;

export const starterCode = `/** Return true if any number appears twice. */
function containsDuplicate(nums: number[]): boolean {
  // Translate your flowchart into code.
  // 1. Remember the numbers you have seen.
  // 2. Check each number before storing it.
  // 3. Handle reaching the end.
  return false;
}
`;
