#!/usr/bin/env node

import { exec } from "node:child_process"
import readline from "node:readline"
import { promisify } from "node:util"

import fuzzy from "./fuzz.js"

const execAsync = promisify(exec)
const MAX_NAME_LENGTH = 40 // Truncate process names for readability

const colors = {
  bold: "\u001B[1m",
  green: "\u001B[32m",
  red: "\u001B[31m",
  reset: "\u001B[0m",
  yellow: "\u001B[33m"
}

async function getProcesses() {
  try {
    const { stdout } = await execAsync("ps aux")
    return stdout
      .split("\n")
      .slice(1)
      .map((line) => {
        const parts = line.trim().split(/\s+/)
        return parts.length > 10 ?
            { name: parts.slice(10).join(" "), pid: Number.parseInt(parts[1]) }
          : null
      })
      .filter(Boolean)
  } catch (error) {
    console.error(
      `${colors.red}Error fetching process list:${colors.reset}`,
      error
    )
    process.exit(1)
  }
}

function truncate(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text
}

function confirmKill(processes, removedThisProcess=false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log(`\n${colors.yellow}Matched processes:${colors.reset}`)
    for (const [index, proc] of processes.entries())
      console.log(
        `  ${colors.bold}[${index + 1}]${colors.reset} [${colors.bold}${proc.pid}${colors.reset}] ${truncate(proc.name, MAX_NAME_LENGTH)}`
      )

    rl.question(
      `\nMatched ${processes.length} processes${removedThisProcess ? " (excluding current)" : ""}. ${colors.yellow}Enter "y" to kill all, "N" to cancel, or a comma-separated list of numbers (e.g., 1,3,5) to kill specific processes: ${colors.reset}`,
      (answer) => {
        rl.close()

        if (answer.toLowerCase() === "y") {
          resolve(processes)
        } else if (answer.toLowerCase() === "n") {
          resolve([])
        } else {
          const selectedIndexes = answer
            .split(",")
            .map((number_) => Number.parseInt(number_.trim(), 10) - 1)
            .filter((number_) => number_ >= 0 && number_ < processes.length)

          resolve(selectedIndexes.map((index) => processes[index]))
        }
      }
    )
  })
}

async function main() {
  if (process.argv.length < 3) {
    console.error(`${colors.red}Usage: killfuzzy <process_name>${colors.reset}`)
    process.exit(1)
  }

  const searchTerm = process.argv[2]
  const processes = await getProcesses()
  let matches = fuzzy(searchTerm, processes)
  let thisProcess = process.pid
  let length = matches.length
  matches = matches.filter((proc) => proc.pid !== thisProcess)
  let length2 = matches.length
  let removedThisProcess = length !== length2;

  if (matches.length === 0) {
    console.log(`${colors.red}No matching processes found${removedThisProcess ? " (removed current process)" : ""}.${colors.reset}`)
    process.exit(0)
  }

  const selectedProcesses = await confirmKill(matches, removedThisProcess)

  if (selectedProcesses.length === 0) {
    console.log(`${colors.yellow}Aborted.${colors.reset}`)
    process.exit(0)
  }

  for (const proc of selectedProcesses) {
    try {
      process.kill(Number.parseInt(proc.pid, 10))
      console.log(
        `${colors.green}✔ Killed process ${proc.pid} (${truncate(proc.name, MAX_NAME_LENGTH)})${colors.reset}`
      )
    } catch (error) {
      console.error(
        `${colors.red}✖ Failed to kill ${proc.pid}: ${error.message}${colors.reset}`
      )
    }
  }
}

main()
