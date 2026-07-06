const fs = require("fs");
const { execSync } = require("child_process");

const originalCode = fs.readFileSync("src/pages/Dashboard.tsx", "utf8");
const lines = originalCode.split("\n");

// We want to test different combinations of tags for lines 5507 to 5510 (0-indexed 5506 to 5509)
// Original lines:
// 5507: "                                            </div>"
// 5508: "                                          </motion.div>"
// 5509: "                                        </div>"
// 5510: "                                      </div>"

const candidates = [
  // Option 1: swap motion.div and div
  [
    "                                          </motion.div>",
    "                                            </div>",
    "                                        </div>",
    "                                      </div>"
  ],
  // Option 2: add an extra div
  [
    "                                            </div>",
    "                                            </div>",
    "                                          </motion.div>",
    "                                        </div>",
    "                                      </div>"
  ],
  // Option 3: remove a div
  [
    "                                          </motion.div>",
    "                                        </div>",
    "                                      </div>"
  ],
  // Option 4: different order of divs
  [
    "                                            </div>",
    "                                        </div>",
    "                                          </motion.div>",
    "                                      </div>"
  ],
  // Option 5: original
  [
    "                                            </div>",
    "                                          </motion.div>",
    "                                        </div>",
    "                                      </div>"
  ],
  // Option 6: let's test if there's a missing div at the very end
  [
    "                                            </div>",
    "                                          </motion.div>",
    "                                        </div>",
    "                                      </div>",
    "                                    </div>"
  ]
];

candidates.forEach((cand, index) => {
  console.log(`\nTesting Candidate ${index + 1}...`);
  const copyLines = [...lines];
  copyLines.splice(5506, 4, ...cand);
  const testCode = copyLines.join("\n");
  fs.writeFileSync("src/pages/Dashboard.tsx", testCode, "utf8");
  
  try {
    execSync("npx esbuild src/pages/Dashboard.tsx --loader=tsx --color=false", { stdio: "ignore" });
    console.log(`Candidate ${index + 1} SUCCEEDED!`);
    process.exit(0);
  } catch (err) {
    // console.log(`Candidate ${index + 1} failed.`);
  }
});

// Restore original
fs.writeFileSync("src/pages/Dashboard.tsx", originalCode, "utf8");
console.log("\nAll candidates failed, restored original.");
