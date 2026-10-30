import bcrypt from "bcryptjs";

const input = process.stdin;
const output = process.stdout;

if (!input.isTTY || typeof input.setRawMode !== "function") {
  output.write("Run this command in an interactive terminal.\n");
  process.exit(1);
}

let password = "";
let finished = false;

function finish(message, exitCode) {
  if (finished) return;
  finished = true;
  input.setRawMode(false);
  input.pause();
  output.write(`\n${message}\n`);
  process.exitCode = exitCode;
}

output.write("Admin password (minimum 12 characters; input is masked): ");
input.setRawMode(true);
input.resume();
input.setEncoding("utf8");

input.on("data", async (chunk) => {
  if (finished) return;
  for (const character of chunk) {
    if (character === "\u0003") {
      finish("Cancelled.", 1);
      return;
    }
    if (character === "\r" || character === "\n") {
      if (password.length < 12) {
        finish("Password must be at least 12 characters.", 1);
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      password = "";
      finish(hash, 0);
      return;
    }
    if (character === "\u007f" || character === "\b") {
      if (password.length > 0) {
        password = password.slice(0, -1);
        output.write("\b \b");
      }
      continue;
    }
    if (!/\p{Cc}/u.test(character)) {
      password += character;
      output.write("*");
    }
  }
});