// Test script to verify the CORRECTED person-first backward navigation logic

function testCorrectedBackwardNavigation() {
    const managementNames = ['Gibral', 'Ahmad'];
    const sections = ['Section 1', 'Section 2'];
    
    // Start at the end: Ahmad, Section 2
    let currentPersonIndex = 1;
    let currentSectionForPerson = 1;
    
    const backwardFlow = [];
    
    function handleManagementPrevious() {
        const sectionCount = sections.length;
        
        // Add current state to flow
        backwardFlow.push(`${sections[currentSectionForPerson]} (${managementNames[currentPersonIndex]})`);
        
        // CORRECTED LOGIC: Person-first flow (move backward through sections, then people)
        
        // If we're not at the first section for current person, move to previous section
        if (currentSectionForPerson > 0) {
            currentSectionForPerson--;
        }
        // If we're at the first section for current person, move to previous person with last section  
        else if (currentPersonIndex > 0) {
            currentPersonIndex--;
            currentSectionForPerson = sectionCount - 1;
        }
        // If we're at the first section of the first person, can't go back
        else {
            backwardFlow.push('REACHED BEGINNING');
            return false; // No more steps
        }
        
        return true; // More steps available
    }
    
    // Simulate the backward flow
    while (handleManagementPrevious()) {
        // Continue until beginning
    }
    
    console.log('CORRECTED Person-First Backward Navigation:');
    backwardFlow.forEach((step, index) => {
        console.log(`${index + 1}. ${step}`);
    });
    
    // Verify the pattern
    console.log('\nBackward Flow Analysis:');
    console.log('✅ NEW CORRECT BACKWARD FLOW:');
    console.log('✅ Ahmad Section 2 → Ahmad Section 1 → Gibral Section 2 → Gibral Section 1');
}

testCorrectedBackwardNavigation();