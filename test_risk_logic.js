
const profession = "Autônomo/Dentista";
const cost = 5000;

// LOGIC
const professionLower = profession.toLowerCase();
const highRiskKeywords = ['autônomo', 'empresário', 'dentista', 'freelancer', 'profissional liberal'];

let riskProfile = 'low';
let targetMonths = 6;

if (highRiskKeywords.some(keyword => professionLower.includes(keyword))) {
    riskProfile = 'high';
    targetMonths = 12;
}
// END LOGIC

const emergencyTarget = targetMonths * cost;

// PRINT CLEAN RESULTS
console.log("TEST_START");
console.log(`Profissão Input: "${profession}"`);
console.log(`Risco: ${riskProfile.toUpperCase()}`);
console.log(`Meses: ${targetMonths}`);
console.log(`Meta: R$ ${emergencyTarget}`);
console.log("TEST_END");
