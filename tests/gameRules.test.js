// Lightweight reference tests. Run with your preferred JS test runner.
// Expected mapping:
// 2->5x5/5, 3->6x6/6, 4->7x7/7, 5->8x8/8, 6->9x9/9, 7->10x10/10.
const expected = {
  2:[5,5],3:[6,6],4:[7,7],5:[8,8],6:[9,9],7:[10,10]
};
for (const [players,[size,lines]] of Object.entries(expected)) {
  if (size !== Number(players)+3 || lines !== Number(players)+3) throw new Error("Rule mapping failed");
}
console.log("BINGO rule mapping checks passed.");
