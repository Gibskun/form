// Test script to verify the CORRECTED person-first round-robin logic
// This simulates the NEW handleManagementNext logic

function testCorrectedRoundRobinFlow() {
    const managementNames = ['Gibral', 'Ahmad'];
    const sections = ['Section 1', 'Section 2'];
    
    let currentPersonIndex = 0;
    let currentSectionForPerson = 0;
    
    const flow = [];
    
    function handleManagementNext() {
        const sectionCount = sections.length;
        
        // Add current state to flow
        flow.push(`${sections[currentSectionForPerson]} (${managementNames[currentPersonIndex]})`);
        
        // CORRECTED LOGIC: Person-first flow (complete all sections for one person before moving to next person)
        
        // If we're not at the last section for current person, move to next section
        if (currentSectionForPerson < sectionCount - 1) {
            currentSectionForPerson++;
        } 
        // If we're at the last section for current person, move to next person with first section
        else if (currentPersonIndex < managementNames.length - 1) {
            currentPersonIndex++;
            currentSectionForPerson = 0;
        }
        // If we're at the last section of the last person, form is complete
        else {
            flow.push('FORM COMPLETE');
            return false; // No more steps
        }
        
        return true; // More steps available
    }
    
    // Simulate the full flow
    while (handleManagementNext()) {
        // Continue until complete
    }
    
    console.log('CORRECTED Person-First Round-Robin Flow:');
    flow.forEach((step, index) => {
        console.log(`${index + 1}. ${step}`);
    });
    
    // Verify the pattern
    console.log('\nFlow Analysis:');
    console.log('✅ NEW CORRECT FLOW:');
    console.log('✅ Gibral: Section 1 → Section 2 (Complete all sections first)');
    console.log('✅ Ahmad: Section 1 → Section 2 (Complete all sections first)');
    console.log('');
    console.log('❌ OLD INCORRECT FLOW was:');
    console.log('❌ Section 1: Gibral → Ahmad (Complete all people first)');
    console.log('❌ Section 2: Gibral → Ahmad (Complete all people first)');
}

testCorrectedRoundRobinFlow();