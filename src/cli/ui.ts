import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Tiny zero-dependency terminal UI helpers: ANSI colors, print/printError, and
 * readline-based prompt/confirm. Colors degrade gracefully when stdout is not a
 * TTY or NO_COLOR is set.
 */

const colorsEnabled = (): boolean =>
  !process.env.NO_COLOR && Boolean(stdout.isTTY);

function wrap(code: string, text: string): string {
  return colorsEnabled() ? `[${code}m${text}[0m` : text;
}

export const bold = (text: string): string => wrap("1", text);
export const dim = (text: string): string => wrap("2", text);
export const green = (text: string): string => wrap("32", text);
export const red = (text: string): string => wrap("31", text);
export const cyan = (text: string): string => wrap("36", text);

/** Print a line to stdout. */
export function print(message = ""): void {
  stdout.write(`${message}\n`);
}

/** Print a line to stderr, prefixed and colored as an error. */
export function printError(message: string): void {
  process.stderr.write(`${red("error")} ${message}\n`);
}

/** Ask a free-text question and return the trimmed answer. */
export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${question} `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

/** Ask a yes/no question; returns true only on an explicit yes. */
export async function confirm(
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await prompt(`${question} ${hint}`)).toLowerCase();
  if (answer === "") {
    return defaultYes;
  }
  return answer === "y" || answer === "yes";
}
