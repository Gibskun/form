import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { formAPI } from '../utils/api';

const FormFiller = () => {
  const router = useRouter();
  const { uniqueLink } = router.query;
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState({
    respondent_name: '',
    respondent_email: ''
  });
  const [responses, setResponses] = useState({});
  const [showQuestions, setShowQuestions] = useState(false);
  const [conditionalQuestions, setConditionalQuestions] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: year question, 2: role selection, 3: conditional questions
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState('');
  const [conditionalSections, setConditionalSections] = useState({ sections: [], questions: [] });
  const [loadingSections, setLoadingSections] = useState(false);
  const [yearBasedSections, setYearBasedSections] = useState({ sections: [], questions: [] });
  
  // Round-robin evaluation state for Management role
  const [managementNames, setManagementNames] = useState([]);
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const [currentSectionForPerson, setCurrentSectionForPerson] = useState(0);
  const [managementResponses, setManagementResponses] = useState({});
  const [isManagementFlow, setIsManagementFlow] = useState(false);
  
  // Multiple management lists state
  const [managementLists, setManagementLists] = useState([]);
  const [selectedManagementList, setSelectedManagementList] = useState(null);
  const [currentListIndex, setCurrentListIndex] = useState(0);
  const [isMultipleManagementFlow, setIsMultipleManagementFlow] = useState(false);


  useEffect(() => {
    if (uniqueLink) {
      fetchForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueLink]);

  const fetchForm = async () => {
    try {
      const response = await formAPI.getForm(uniqueLink);
      console.log('🔍 FormFiller received form data:', response.data);
      console.log('📋 Assessment questions with scale_order:');
      response.data.questions.forEach(q => {
        if (q.question_type === 'assessment') {
          console.log(`Q${q.id}: ${q.question_text} - scale_order:`, q.scale_order);
        }
      });
      setForm(response.data);
      
      // Check if form has any conditional logic
      const hasYearConditions = (response.data.conditional_questions && response.data.conditional_questions.length > 0) ||
                                (response.data.conditional_sections && response.data.conditional_sections.length > 0);
      const hasRoleConditions = response.data.role_based_conditional_sections && response.data.role_based_conditional_sections.length > 0;
      const hasManagementLists = response.data.management_lists && response.data.management_lists.length > 0;
      
      const hasAnyConditionalLogic = hasYearConditions || hasRoleConditions || hasManagementLists;
      
      // If form doesn't require user info, skip to questions directly
      if (response.data.require_user_info === false) {
        console.log('📝 Form does not require user info, skipping to questions');
        setShowQuestions(true);
        setUserInfo({
          respondent_name: '',
          respondent_email: ''
        });
      }
      
      // If there's no conditional logic, skip directly to step 3 (questions)
      if (!hasAnyConditionalLogic) {
        console.log('✅ No conditional logic detected, skipping to questions step');
        setCurrentStep(3);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Form not found');
    } finally {
      setLoading(false);
    }
  };

  const handleUserInfoSubmit = async (e) => {
    e.preventDefault();
    
    // Check if form requires user info
    if (form.require_user_info) {
      if (!userInfo.respondent_name.trim() || !userInfo.respondent_email.trim()) {
        setError('Please fill in both name and email');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userInfo.respondent_email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setError('');
    setShowQuestions(true);
  };

  const handleYearChange = async (year) => {
    setSelectedYear(year);
    setResponses({ ...responses, year_selection: year });

    // Fetch conditional questions based on selected year (legacy support)
    if (form.conditional_questions && form.conditional_questions.length > 0 && year) {
      try {
        setLoadingQuestions(true);
        setError(''); // Clear any previous errors
        const response = await formAPI.getConditionalQuestions(uniqueLink, year);
        setConditionalQuestions(response.data || []);
        
        // Show success message if conditional questions were found
        if (response.data && response.data.length > 0) {
          console.log(`✓ Loaded ${response.data.length} conditional questions for year ${year}`);
        }
      } catch (error) {
        console.error('Failed to fetch conditional questions:', error);
        setConditionalQuestions([]);
        // Don't show error to user unless it's critical, as this is optional functionality
      } finally {
        setLoadingQuestions(false);
      }
    } else if (!year) {
      // Clear conditional questions if no year selected
      setConditionalQuestions([]);
      setLoadingQuestions(false);
    }

    // Fetch year-based conditional sections
    if (form.conditional_sections && form.conditional_sections.length > 0 && year) {
      try {
        setLoadingQuestions(true);
        const response = await formAPI.getConditionalSections(uniqueLink, year);
        setYearBasedSections(response.data || { sections: [], questions: [] });
        console.log(`✓ Loaded ${response.data?.sections?.length || 0} year-based sections for ${year}`);
      } catch (error) {
        console.error('Failed to fetch year-based sections:', error);
        setYearBasedSections({ sections: [], questions: [] });
      } finally {
        setLoadingQuestions(false);
      }
    } else if (!year) {
      setYearBasedSections({ sections: [], questions: [] });
    }

    // If role is already selected and both conditions exist, update combined sections
    if (selectedRole && year) {
      const hasYearConditions = form.conditional_sections && form.conditional_sections.length > 0;
      const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
      
      if (hasYearConditions && hasRoleConditions) {
        try {
          setLoadingSections(true);
          const response = await formAPI.getCombinedConditionalSections(uniqueLink, year, selectedRole);
          setConditionalSections(response.data || { sections: [], questions: [] });
          console.log(`✓ Updated combined sections for year ${year} + role ${selectedRole}`);
        } catch (error) {
          console.error('Failed to update combined conditional sections:', error);
          setConditionalSections({ sections: [], questions: [] });
        } finally {
          setLoadingSections(false);
        }
      }
    }
  };

  const handleYearNext = () => {
    if (!selectedYear) {
      setError('Please select your year of entry first');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleRoleChange = async (role) => {
    setSelectedRole(role);
    setResponses({ ...responses, role_selection: role });

    // Special handling for Management role - check for multiple management lists
    if (role === 'management') {
      // Check if the form has multiple management lists
      if (form.management_lists && form.management_lists.length > 0) {
        setManagementLists(form.management_lists);
        setIsMultipleManagementFlow(true);
        console.log('🏢 Multiple management lists found:', form.management_lists);
        
        // AUTO-PROCESS ALL MANAGEMENT LISTS (no selection step)
        // Set up to evaluate all lists sequentially
        setCurrentListIndex(0); // Start with first list
        const firstList = form.management_lists[0];
        
        // Extract names from the first list
        const names = firstList.management_names
          .split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0)
          .map(name => name.replace(/^\d+\.\s*/, '')); // Remove numbering if present
        
        setManagementNames(names);
        
        // Get sections and questions for the first management list
        const listSections = form.sections.filter(section => 
          firstList.section_ids.includes(section.id)
        );
        const listQuestions = form.questions.filter(question => 
          firstList.section_ids.includes(question.section_id)
        );
        
        setConditionalSections({
          sections: listSections,
          questions: listQuestions
        });
        
        // Initialize management flow state
        setIsManagementFlow(true);
        setSelectedManagementList(firstList);
        setCurrentPersonIndex(0);
        setCurrentSectionForPerson(0);
        
        console.log('👥 Starting with first management list:', firstList.list_name);
        console.log('👤 Names to evaluate:', names);
        
        return; // Stop here, ready to start evaluation
      } else {
        // Fall back to legacy single management flow
        try {
          setLoadingSections(true);
          setError('');
          
          // For Management role, only use role-based sections (ignore year conditions)
          const response = await formAPI.getRoleBasedSections(uniqueLink, role);
          setConditionalSections(response.data || { sections: [], questions: [] });
          
          console.log('🏢 Management role selected - bypassing year logic');
          console.log('📋 Loaded management sections:', response.data);
          
          if (response.data && response.data.sections && response.data.sections.length > 0) {
            console.log(`✓ Loaded ${response.data.sections.length} sections for Management role`);
            console.log(`✓ Loaded ${response.data.questions.length} questions for Management role`);
            
            // Extract management names from the role-based conditional sections
            const managementSection = response.data.managementConfig;
            if (managementSection && managementSection.management_names) {
              const names = managementSection.management_names
                .split('\n')
                .map(name => name.trim())
                .filter(name => name.length > 0)
                .map(name => name.replace(/^\d+\.\s*/, '')); // Remove numbering if present
              
              setManagementNames(names);
              setIsManagementFlow(true);
              setCurrentPersonIndex(0);
              setCurrentSectionForPerson(0);
              console.log('👥 Management names loaded:', names);
            }
          }
        } catch (error) {
          console.error('Failed to fetch management sections:', error);
          setConditionalSections({ sections: [], questions: [] });
        } finally {
          setLoadingSections(false);
        }
      }
      return; // Exit early for Management role
    }

    // Use combined conditional logic when both year and role conditions exist (for Employee/Team Lead)
    const hasYearConditions = form.conditional_sections && form.conditional_sections.length > 0;
    const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;

    if ((hasYearConditions && hasRoleConditions) && role && selectedYear) {
      try {
        setLoadingSections(true);
        setError('');
        
        // Use the new combined API that handles both year and role
        const response = await formAPI.getCombinedConditionalSections(uniqueLink, selectedYear, role);
        setConditionalSections(response.data || { sections: [], questions: [] });
        
        console.log('🔍 Combined conditional sections response:', response.data);
        console.log('🔍 Full API response status:', response.status);
        console.log('🔍 Setting conditionalSections to:', response.data);
        
        if (response.data && response.data.sections && response.data.sections.length > 0) {
          console.log(`✓ Loaded ${response.data.sections.length} sections for year ${selectedYear} + role ${role}`);
          console.log(`✓ Loaded ${response.data.questions.length} questions for year ${selectedYear} + role ${role}`);
          console.log('📋 Sections loaded:', response.data.sections.map(s => ({ id: s.id, name: s.section_name })));
          console.log('📋 Questions loaded:', response.data.questions.map(q => ({ id: q.id, text: q.question_text, section_id: q.section_id })));
        } else {
          console.log(`⚠ No sections found for year ${selectedYear} + role ${role}`);
          console.log('🔍 response.data:', response.data);
        }
      } catch (error) {
        console.error('Failed to fetch combined conditional sections:', error);
        setConditionalSections({ sections: [], questions: [] });
      } finally {
        setLoadingSections(false);
      }
    } 
    // Fallback to role-only logic (legacy)
    else if (hasRoleConditions && role) {
      try {
        setLoadingSections(true);
        setError('');
        const response = await formAPI.getRoleBasedSections(uniqueLink, role);
        setConditionalSections(response.data || { sections: [], questions: [] });
        
        if (response.data && response.data.sections && response.data.sections.length > 0) {
          console.log(`✓ Loaded ${response.data.sections.length} sections for role ${role}`);
          console.log(`✓ Loaded ${response.data.questions.length} questions for role ${role}`);
        }
      } catch (error) {
        console.error('Failed to fetch role-based sections:', error);
        setConditionalSections({ sections: [], questions: [] });
      } finally {
        setLoadingSections(false);
      }
    } else if (!role) {
      setConditionalSections({ sections: [], questions: [] });
      setLoadingSections(false);
    }
  };

  const handleRoleNext = () => {
    if (!selectedRole) {
      setError('Please select your role first');
      return;
    }
    
    // Check if sections are still loading
    if (loadingSections) {
      setError('Please wait while we load your questions...');
      return;
    }
    
    // For Management role, skip selection step and go directly to questions
    if (selectedRole === 'management') {
      if (isMultipleManagementFlow) {
        // Skip management list selection step - auto process all lists
        if (!conditionalSections.questions || conditionalSections.questions.length === 0) {
          setError('No questions found for Management role. Please contact administrator.');
          return;
        }
        setError('');
        setCurrentStep(3); // Go directly to questions
        return;
      } else {
        // Legacy single management flow
        if (!conditionalSections.questions || conditionalSections.questions.length === 0) {
          setError('No questions found for Management role. Please contact administrator.');
          return;
        }
        setError('');
        setCurrentStep(3);
        return;
      }
    }
    
    // Check if we're in combined mode and have sections loaded (for Employee/Team Lead)
    const hasYearConditions = form.conditional_sections && form.conditional_sections.length > 0;
    const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
    
    if (hasYearConditions && hasRoleConditions) {
      // In combined mode, make sure conditionalSections has data
      if (!conditionalSections.questions || conditionalSections.questions.length === 0) {
        setError('No questions found for your selected year and role combination. Please try different selections.');
        return;
      }
    }
    
    setError('');
    setCurrentStep(3);
  };

  const handleBackToYear = () => {
    setCurrentStep(1);
    setError('');
  };

  const handleBackToRole = () => {
    setCurrentStep(2);
    setError('');
  };

  // Management round-robin navigation handlers
  const handleManagementNext = () => {
    const sectionCount = Object.keys(getQuestionsBySections()).length;
    
    // CORRECTED LOGIC: Person-first flow (complete all sections for one person before moving to next person)
    
    // If we're not at the last section for current person, move to next section
    if (currentSectionForPerson < sectionCount - 1) {
      setCurrentSectionForPerson(currentSectionForPerson + 1);
    } 
    // If we're at the last section for current person, move to next person with first section
    else if (currentPersonIndex < managementNames.length - 1) {
      setCurrentPersonIndex(currentPersonIndex + 1);
      setCurrentSectionForPerson(0);
    }
    // If we're at the last section of the last person
    else {
      // Check if there are more management lists to process
      if (isMultipleManagementFlow && currentListIndex < managementLists.length - 1) {
        // Move to next management list
        const nextListIndex = currentListIndex + 1;
        const nextList = managementLists[nextListIndex];
        
        console.log(`🏢 Moving to next management list: ${nextList.list_name}`);
        
        // Extract names from the next list
        const names = nextList.management_names
          .split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0)
          .map(name => name.replace(/^\d+\.\s*/, '')); // Remove numbering if present
        
        // Get sections and questions for the next management list
        const listSections = form.sections.filter(section => 
          nextList.section_ids.includes(section.id)
        );
        const listQuestions = form.questions.filter(question => 
          nextList.section_ids.includes(question.section_id)
        );
        
        // Update state for next list
        setCurrentListIndex(nextListIndex);
        setSelectedManagementList(nextList);
        setManagementNames(names);
        setConditionalSections({
          sections: listSections,
          questions: listQuestions
        });
        
        // Reset person and section indices for the new list
        setCurrentPersonIndex(0);
        setCurrentSectionForPerson(0);
        
        console.log(`👥 Starting evaluation of ${names.length} people in list: ${nextList.list_name}`);
      }
      // If this was the last management list, form is complete (handled in render)
    }
  };

  const handleManagementPrevious = () => {
    // CORRECTED LOGIC: Person-first flow (move backward through sections, then people)
    
    // If we're not at the first section for current person, move to previous section
    if (currentSectionForPerson > 0) {
      setCurrentSectionForPerson(currentSectionForPerson - 1);
    }
    // If we're at the first section for current person, move to previous person with last section  
    else if (currentPersonIndex > 0) {
      setCurrentPersonIndex(currentPersonIndex - 1);
      setCurrentSectionForPerson(Object.keys(getQuestionsBySections()).length - 1);
    }
    // If we're at the first section of the first person, can't go back (handled in render)
  };

  const handleResponseChange = (questionId, value, questionType) => {
    if (isManagementFlow) {
      // For management flow, store responses per list per person per section
      const listKey = isMultipleManagementFlow ? `list_${currentListIndex}` : 'legacy';
      const personKey = `${managementNames[currentPersonIndex]}_${currentSectionForPerson}`;
      const fullKey = `${listKey}_${personKey}`;
      
      setManagementResponses({
        ...managementResponses,
        [fullKey]: {
          ...managementResponses[fullKey],
          [questionId]: value
        }
      });
    } else {
      // Regular flow
      setResponses({
        ...responses,
        [questionId]: value
      });
    }
  };

  // Organize multiple management list responses for better Excel export
  const organizeMultipleListResponses = () => {
    if (!isMultipleManagementFlow || !managementLists) return null;

    const organized = {};
    
    managementLists.forEach((list, listIndex) => {
      organized[list.list_name] = {
        list_description: list.list_description,
        people: {},
        sections: {}
      };

      // Get sections for this list
      const listSections = form.sections.filter(section => 
        list.section_ids.includes(section.id)
      );

      // Get names for this list
      const listNames = list.management_names
        .split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => name.replace(/^\d+\.\s*/, ''));

      // Organize responses by person and section
      listNames.forEach(personName => {
        organized[list.list_name].people[personName] = {};
        
        listSections.forEach((section, sectionIndex) => {
          const listKey = `list_${listIndex}`;
          const personKey = `${personName}_${sectionIndex}`;
          const fullKey = `${listKey}_${personKey}`;
          
          if (managementResponses[fullKey]) {
            if (!organized[list.list_name].sections[section.name || section.section_name]) {
              organized[list.list_name].sections[section.name || section.section_name] = {};
            }
            
            organized[list.list_name].people[personName][section.name || section.section_name] = managementResponses[fullKey];
            organized[list.list_name].sections[section.name || section.section_name][personName] = managementResponses[fullKey];
          }
        });
      });
    });

    return organized;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isManagementFlow) {
        console.log('🏢 Management flow submission - Debug info:', {
          isMultipleManagementFlow,
          currentListIndex,
          totalLists: managementLists.length,
          managementNames,
          currentPersonIndex,
          currentSectionForPerson,
          managementResponsesKeys: Object.keys(managementResponses),
          managementResponsesData: managementResponses
        });

        // Validate that at least some responses exist for management flow
        if (!managementResponses || Object.keys(managementResponses).length === 0) {
          throw new Error('Please answer at least some questions before submitting the assessment.');
        }

        // Collect all evaluated people across all management lists
        let allEvaluatedPeople = [];
        if (isMultipleManagementFlow) {
          // Collect names from all management lists
          managementLists.forEach(list => {
            const names = list.management_names
              .split('\n')
              .map(name => name.trim())
              .filter(name => name.length > 0)
              .map(name => name.replace(/^\d+\.\s*/, ''));
            allEvaluatedPeople = [...allEvaluatedPeople, ...names];
          });
        } else {
          allEvaluatedPeople = managementNames;
        }

        // Management flow submission - compile all responses with better organization
        const managementPayload = {
          ...userInfo,
          role_selection: 'management',
          management_evaluation: true,
          evaluator_name: userInfo.respondent_name,
          evaluated_people: allEvaluatedPeople,
          management_responses: managementResponses,
          multiple_lists: isMultipleManagementFlow,
          management_lists_data: isMultipleManagementFlow ? managementLists : null,
          // Add organized response structure for better Excel export
          organized_responses: isMultipleManagementFlow ? organizeMultipleListResponses() : null
        };

        await formAPI.submitForm(uniqueLink, managementPayload);
        setSubmitted(true);
        return;
      }

      // Regular flow validation and submission
      console.log('🔍 Regular flow submission - Debug info:', {
        selectedYear,
        selectedRole,
        responsesKeys: Object.keys(responses),
        responsesData: responses,
        allQuestionsCount: getQuestionsToShow().length
      });

      // Check if form has any conditional logic
      const hasYearConditions = (form.conditional_questions && form.conditional_questions.length > 0) ||
                                (form.conditional_sections && form.conditional_sections.length > 0);
      const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
      const hasManagementLists = form.management_lists && form.management_lists.length > 0;
      const hasAnyConditionalLogic = hasYearConditions || hasRoleConditions || hasManagementLists;

      // Validate year selection (only if conditional logic exists)
      if (hasAnyConditionalLogic && !selectedYear) {
        throw new Error('Please select your year of entry before submitting the form');
      }

      // Validate all required questions across all sections
      const allQuestions = getQuestionsToShow();
      const requiredQuestions = allQuestions.filter(q => q.is_required);

      console.log('🔍 Validation info:', {
        allQuestionsCount: allQuestions.length,
        requiredQuestionsCount: requiredQuestions.length,
        userHasAnswered: Object.keys(responses).length
      });

      // Ensure user has answered at least some questions
      if (allQuestions.length > 0 && Object.keys(responses).length === 0) {
        throw new Error('Please answer at least some questions before submitting the form.');
      }

      for (const question of requiredQuestions) {
        const val = responses[question.id];

        // Handle checkbox (array) specially
        if (question.question_type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            throw new Error(`Please answer: ${question.question_text}`);
          }
          continue;
        }

        // For other types, treat null/undefined/empty-string as unanswered
        if (val === null || val === undefined || val === '') {
          throw new Error(`Please answer: ${question.question_text}`);
        }
      }

      const payload = {
        ...userInfo,
        responses: responses || {}, // Ensure responses is never null/undefined
        role_selection: selectedRole,
        year_selection: selectedYear
      };

      await formAPI.submitForm(uniqueLink, payload);
      setSubmitted(true);
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    let value;
    
    if (isManagementFlow) {
      // For management flow, get response for current list, person and section
      const listKey = isMultipleManagementFlow ? `list_${currentListIndex}` : 'legacy';
      const personKey = `${managementNames[currentPersonIndex]}_${currentSectionForPerson}`;
      const fullKey = `${listKey}_${personKey}`;
      value = managementResponses[fullKey]?.[question.id] || '';
    } else {
      // Regular flow
      value = responses[question.id] || '';
    }

    switch (question.question_type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <input
            type={question.question_type}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="form-input"
            required={question.is_required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="form-textarea"
            rows="4"
            required={question.is_required}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => {
              const newValue = e.target.value;
              handleResponseChange(question.id, newValue);
              
              // Enhanced year detection for conditional questions
              const questionText = question.question_text.toLowerCase();
              const yearKeywords = [
                'year',
                'joined',
                'entry',
                'started',
                'admission',
                'enrolled',
                'began'
              ];
              
              const hasYearKeyword = yearKeywords.some(keyword => 
                questionText.includes(keyword)
              );
              
              if (hasYearKeyword && /^\d{4}$/.test(newValue)) {
                handleYearChange(newValue);
              }
            }}
            className="form-select"
            required={question.is_required}
          >
            <option value="">Select an option</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div>
            {question.options?.map((option, index) => (
              <label key={index} style={{ display: 'block', margin: '8px 0' }}>
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    handleResponseChange(question.id, newValue);
                    
                    // Enhanced year detection for radio buttons
                    const questionText = question.question_text.toLowerCase();
                    const yearKeywords = [
                      'year',
                      'joined',
                      'entry',
                      'started',
                      'admission',
                      'enrolled',
                      'began'
                    ];
                    
                    const hasYearKeyword = yearKeywords.some(keyword => 
                      questionText.includes(keyword)
                    );
                    
                    if (hasYearKeyword && /^\d{4}$/.test(newValue)) {
                      handleYearChange(newValue);
                    }
                  }}
                  style={{ marginRight: '8px' }}
                />
                {option.text}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div>
            {question.options?.map((option, index) => (
              <label key={index} style={{ display: 'block', margin: '8px 0' }}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={Array.isArray(value) ? value.includes(option.value) : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    handleResponseChange(question.id, newValues);
                  }}
                  style={{ marginRight: '8px' }}
                />
                {option.text}
              </label>
            ))}
          </div>
        );

      case 'assessment':
        return (
          <div>
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              {/* Main horizontal layout container */}
              <div className="assessment-container">
                {/* Left Statement */}
                <div className="assessment-statement assessment-statement-left">
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#495057',
                    marginBottom: '8px'
                  }}>
                  </div>
                  <div style={{ 
                    fontSize: '15px',
                    lineHeight: '1.4',
                    color: '#343a40',
                    marginBottom: '5px'
                  }}>
                    {question.left_statement}
                  </div>
                  {question.left_statement_id && (
                    <div style={{ 
                      fontSize: '15px',
                      lineHeight: '1.4',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      {question.left_statement_id}
                    </div>
                  )}
                </div>

                {/* Rating Scale */}
                <div className="assessment-rating-container">
                  {(question.scale_order || [1, 2, 3, 4, 5]).map(rating => (
                    <div key={rating} className="assessment-rating-item">
                      <input
                        type="radio"
                        id={`${question.id}_${rating}`}
                        name={`assessment_${question.id}`}
                        value={rating}
                        checked={parseInt(value) === rating}
                        onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
                        className="assessment-rating-input"
                      />
                      <label 
                        htmlFor={`${question.id}_${rating}`}
                        className="assessment-rating-label"
                      >
                        {/* Number hidden for cleaner UI */}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Right Statement */}
                <div className="assessment-statement assessment-statement-right">
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#495057',
                    marginBottom: '8px'
                  }}>
                  </div>
                  <div style={{ 
                    fontSize: '15px',
                    lineHeight: '1.4',
                    color: '#343a40',
                    marginBottom: '5px'
                  }}>
                    {question.right_statement}
                  </div>
                  {question.right_statement_id && (
                    <div style={{ 
                      fontSize: '15px',
                      lineHeight: '1.4',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      {question.right_statement_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Helper text */}
              <div style={{ 
                marginTop: '15px', 
                textAlign: 'center',
                fontSize: '13px',
                color: '#6c757d',
                fontStyle: 'italic'
              }}>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  const getQuestionsToShow = () => {
    if (!form) return [];
    
    // Check if form has any conditional logic
    const hasYearConditions = (form.conditional_questions && form.conditional_questions.length > 0) ||
                              (form.conditional_sections && form.conditional_sections.length > 0);
    const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
    const hasManagementLists = form.management_lists && form.management_lists.length > 0;
    const hasAnyConditionalLogic = hasYearConditions || hasRoleConditions || hasManagementLists;
    
    // If NO conditional logic exists, return all form questions directly
    if (!hasAnyConditionalLogic) {
      console.log('✅ No conditional logic - returning all form questions:', form.questions?.length || 0);
      return form.questions || [];
    }
    
    // Special handling for Management role - bypass year requirements
    if (selectedRole === 'management') {
      console.log('🏢 Management role - bypassing year requirements');
      if (conditionalSections.questions && conditionalSections.questions.length > 0) {
        console.log('✅ Using management conditional sections:', conditionalSections.questions.length, 'questions');
        return conditionalSections.questions;
      } else {
        console.log('⚠️ No management sections found');
        return [];
      }
    }
    
    // If no year selected, don't show any questions (for Employee/Team Lead)
    if (!selectedYear) {
      return [];
    }

    const hasYearConditionsCheck = form.conditional_sections && form.conditional_sections.length > 0;
    const hasRoleConditionsCheck = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;

    console.log('🔍 getQuestionsToShow DEBUG:', {
      selectedYear,
      selectedRole,
      hasYearConditions: hasYearConditionsCheck,
      hasRoleConditions: hasRoleConditionsCheck,
      conditionalSections,
      conditionalSectionsLength: conditionalSections.questions?.length || 0,
      yearBasedSections,
      yearBasedSectionsLength: yearBasedSections.questions?.length || 0,
      formQuestions: form.questions?.length || 0
    });

    // Check for combined conditional logic (year + role)
    if (hasYearConditionsCheck && hasRoleConditionsCheck) {
      console.log('🎯 Using COMBINED conditional logic path');
      // If role not selected yet, don't show questions
      if (!selectedRole) {
        console.log('⚠️ Role not selected, showing no questions');
        return [];
      }
      // Return questions from combined conditional sections
      if (conditionalSections.questions && conditionalSections.questions.length > 0) {
        console.log('✅ Using combined conditional sections:', conditionalSections.questions.length, 'questions');
        console.log('📋 Combined questions:', conditionalSections.questions.map(q => ({ id: q.id, text: q.question_text, section_id: q.section_id })));
        return conditionalSections.questions;
      } else {
        // No combined sections match the criteria, don't show any questions
        console.log('⚠️ No combined sections found, showing no questions');
        console.log('🔍 conditionalSections.questions:', conditionalSections.questions);
        return [];
      }
    }
    
    // Check for role-based conditional logic only
    if (hasRoleConditionsCheck && !hasYearConditionsCheck) {
      // If role not selected yet, don't show questions
      if (!selectedRole) {
        return [];
      }
      // Return questions from conditional sections based on role
      if (conditionalSections.questions && conditionalSections.questions.length > 0) {
        console.log('✅ Using role-based conditional sections:', conditionalSections.questions.length, 'questions');
        return conditionalSections.questions;
      } else {
        // No conditional sections for this role, show standard form questions
        console.log('⚠️ No role-based sections, using standard form questions');
        return form.questions || [];
      }
    }

    // Check for year-based conditional logic only
    if (hasYearConditionsCheck && !hasRoleConditionsCheck) {
      // Return questions from year-based conditional sections
      if (yearBasedSections.questions && yearBasedSections.questions.length > 0) {
        console.log('✅ Using year-based conditional sections:', yearBasedSections.questions.length, 'questions');
        return yearBasedSections.questions;
      } else {
        // No conditional sections for this year, show standard form questions
        console.log('⚠️ No year-based sections, using standard form questions');
        return form.questions || [];
      }
    }
    
    // Fall back to legacy year-based conditional questions
    if (form.conditional_questions && form.conditional_questions.length > 0) {
      console.log('✅ Using legacy conditional questions:', conditionalQuestions.length, 'questions');
      return conditionalQuestions;
    }

    // If no conditional logic configured, show all base questions
    console.log('✅ Using all base form questions:', (form.questions || []).length, 'questions');
    return form.questions || [];
  };

  const getQuestionsBySections = () => {
    const questions = getQuestionsToShow();
    if (!questions || questions.length === 0) return {};

    console.log('🔍 getQuestionsBySections DEBUG:', {
      questionsCount: questions.length,
      questions: questions.map(q => ({ id: q.id, text: q.question_text, section_id: q.section_id })),
      conditionalSections: conditionalSections.sections,
      conditionalSectionsIds: conditionalSections.sections?.map(s => s.id),
      yearBasedSections: yearBasedSections.sections,
      yearBasedSectionsIds: yearBasedSections.sections?.map(s => s.id),
      formSections: form.sections
    });

    // Group questions by sections
    const questionsBySection = {};
    const unassignedQuestions = [];

    // Check if we're in combined mode (both year and role conditions exist)
    const hasYearConditions = form.conditional_sections && form.conditional_sections.length > 0;
    const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
    const isInCombinedMode = hasYearConditions && hasRoleConditions && selectedYear && selectedRole;

    questions.forEach(question => {
      if (question.section_id) {
        console.log(`🔎 Processing question ID ${question.id} with section_id ${question.section_id} (type: ${typeof question.section_id})`);
        
        let section = null;
        
        // In combined mode, ONLY use conditionalSections - don't fall back to yearBasedSections
        if (isInCombinedMode) {
          if (conditionalSections.sections && conditionalSections.sections.length > 0) {
            console.log(`🔍 Combined mode: Checking conditionalSections.sections:`, conditionalSections.sections.map(s => `ID: ${s.id} (type: ${typeof s.id}), Name: ${s.section_name}`));
            section = conditionalSections.sections.find(s => s.id === question.section_id);
            if (section) {
              console.log(`📂 Found section in conditionalSections: ${section.section_name} (ID: ${section.id})`);
            } else {
              console.log(`❌ Section ${question.section_id} NOT found in conditionalSections:`, conditionalSections.sections.map(s => s.id));
            }
          }
          
          // Fallback to form.sections if not found in conditionalSections
          if (!section && form.sections) {
            section = form.sections.find(s => s.id === question.section_id);
            if (section) {
              console.log(`📂 Found section in form.sections: ${section.section_name} (ID: ${section.id})`);
            }
          }
        } else {
          // Not in combined mode - use the original logic
          
          // First check if we have conditional sections (for role-based logic)
          if (conditionalSections.sections && conditionalSections.sections.length > 0) {
            console.log(`🔍 Checking conditionalSections.sections:`, conditionalSections.sections.map(s => `ID: ${s.id} (type: ${typeof s.id}), Name: ${s.section_name}`));
            section = conditionalSections.sections.find(s => s.id === question.section_id);
            if (section) {
              console.log(`📂 Found section in conditionalSections: ${section.section_name} (ID: ${section.id})`);
            } else {
              console.log(`❌ Section ${question.section_id} NOT found in conditionalSections:`, conditionalSections.sections.map(s => s.id));
            }
          }
          
          // If not found in conditional sections, check year-based sections
          if (!section && yearBasedSections.sections && yearBasedSections.sections.length > 0) {
            console.log(`🔍 Checking yearBasedSections.sections:`, yearBasedSections.sections.map(s => `ID: ${s.id} (type: ${typeof s.id}), Name: ${s.section_name}`));
            section = yearBasedSections.sections.find(s => s.id === question.section_id);
            if (section) {
              console.log(`📂 Found section in yearBasedSections: ${section.section_name} (ID: ${section.id})`);
            } else {
              console.log(`❌ Section ${question.section_id} NOT found in yearBasedSections:`, yearBasedSections.sections.map(s => s.id));
            }
          }
          
          // If not found in year-based sections, check form.sections
          if (!section && form.sections) {
            section = form.sections.find(s => s.id === question.section_id);
            if (section) {
              console.log(`📂 Found section in form.sections: ${section.section_name} (ID: ${section.id})`);
            } else {
              console.log(`❌ Section ${question.section_id} NOT found in form.sections`);
            }
          }
        }
        
        const sectionName = section ? (section.section_name || section.name) : `Section ${question.section_id}`;
        console.log(`📝 Question "${question.question_text}" → Section "${sectionName}"`);
        
        if (!questionsBySection[sectionName]) {
          questionsBySection[sectionName] = [];
        }
        questionsBySection[sectionName].push(question);
      } else {
        unassignedQuestions.push(question);
      }
    });

    // Add unassigned questions as a separate section if they exist
    if (unassignedQuestions.length > 0) {
      questionsBySection['Unassigned Questions'] = unassignedQuestions;
    }

    console.log('📊 Final questionsBySection:', Object.keys(questionsBySection).map(key => ({
      sectionName: key,
      questionCount: questionsBySection[key].length
    })));

    return questionsBySection;
  };

  // Initialize sections order when questions are available
  useEffect(() => {
    if (showQuestions && selectedYear) {
      setCurrentSectionIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuestions, selectedYear, selectedRole, conditionalQuestions, conditionalSections, yearBasedSections, form]);

  // Get current section data
  const getCurrentSectionData = () => {
    const questionsBySection = getQuestionsBySections();
    const sectionNames = Object.keys(questionsBySection);
    
    // Handle case where no sections exist - show all questions as one section
    if (sectionNames.length === 0) {
      const allQuestions = getQuestionsToShow();
      return {
        sectionName: 'Form Questions',
        questions: allQuestions
      };
    }
    
    if (currentSectionIndex >= sectionNames.length) {
      return { sectionName: '', questions: [] };
    }
    
    const currentSectionName = sectionNames[currentSectionIndex];
    return {
      sectionName: currentSectionName,
      questions: questionsBySection[currentSectionName] || []
    };
  };

  // Validate current section
  const validateCurrentSection = () => {
    const { questions } = getCurrentSectionData();
    const requiredQuestions = questions.filter(q => q.is_required);

    for (const question of requiredQuestions) {
      const val = responses[question.id];

      // Handle checkbox (array) specially
      if (question.question_type === 'checkbox') {
        if (!Array.isArray(val) || val.length === 0) {
          return { isValid: false, message: `Please answer: ${question.question_text}` };
        }
        continue;
      }

      // For other types, treat null/undefined/empty-string as unanswered
      if (val === null || val === undefined || val === '') {
        return { isValid: false, message: `Please answer: ${question.question_text}` };
      }
    }

    return { isValid: true };
  };

  // Navigate to next section
  const handleNextSection = () => {
    const validation = validateCurrentSection();
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }

    setError('');
    setCurrentSectionIndex(prev => prev + 1);
  };

  // Navigate to previous section
  const handlePreviousSection = () => {
    setError('');
    setCurrentSectionIndex(prev => Math.max(0, prev - 1));
  };

  // Check if user is on the last section
  const isLastSection = () => {
    const questionsBySection = getQuestionsBySections();
    const sectionCount = Object.keys(questionsBySection).length || 1; // At least 1 section
    return currentSectionIndex >= sectionCount - 1;
  };

  if (loading) return <div className="loading">Loading form...</div>;
  if (error && !form) return <div className="container"><div className="error">{error}</div></div>;

  if (submitted) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', maxWidth: '600px', margin: '100px auto' }}>
          <h2 style={{ color: '#28a745' }}>✅ Form Submitted Successfully!</h2>
          <p>Thank you for your response. Your submission has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '800px', margin: '20px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          {form.form_type === 'assessment' && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: '500' }}>
                {form.title}
              </p>
              <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: '500', color: '#666' }}>
                {form.description || 'Assessment Form'}
              </p>
            </div>
          )}
          
          {form.form_type !== 'assessment' && (
            <>
              <h1>{form.title}</h1>
              {form.description && (
                <p style={{ color: '#666', marginTop: '10px' }}>{form.description}</p>
              )}
            </>
          )}
        </div>

        {!showQuestions ? (
          <form onSubmit={handleUserInfoSubmit}>
            <h3>Before you start, please provide your information:</h3>
            {error && <div className="error">{error}</div>}
            
            <div className="form-group">
              <label className="form-label">Full Name:</label>
              <input
                type="text"
                value={userInfo.respondent_name}
                onChange={(e) => setUserInfo({ ...userInfo, respondent_name: e.target.value })}
                className="form-input"
                required={form.require_user_info !== false}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email:</label>
              <input
                type="email"
                value={userInfo.respondent_email}
                onChange={(e) => setUserInfo({ ...userInfo, respondent_email: e.target.value })}
                className="form-input"
                required={form.require_user_info !== false}
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Continue to Form
            </button>
          </form>
        ) : (
          <>
            {error && <div className="error">{error}</div>}
            
            {/* Step Navigation Progress Bar - Only show if there's conditional logic */}
            {(() => {
              const hasYearConditions = (form.conditional_questions && form.conditional_questions.length > 0) ||
                                        (form.conditional_sections && form.conditional_sections.length > 0);
              const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
              const hasManagementLists = form.management_lists && form.management_lists.length > 0;
              const hasAnyConditionalLogic = hasYearConditions || hasRoleConditions || hasManagementLists;
              
              if (!hasAnyConditionalLogic) {
                return null; // Don't show progress bar if no conditional logic
              }
              
              return (
                <div style={{ 
                  marginBottom: '25px', 
                  padding: '20px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '10px',
                  border: '1px solid #e9ecef',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0', color: '#495057' }}>Form Progress</h4>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
                      Step {currentStep} of 3
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ 
                      display: 'flex', 
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {/* Step 1: Year Selection */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: currentStep === 1 ? '#007bff' : '#28a745',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === 1 ? '#007bff' : '#28a745',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '10px',
                      fontSize: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease'
                    }}>
                      {currentStep === 1 ? '1' : '✓'}
                    </div>
                    <span>Year</span>
                  </div>
                  
                  {/* Connector 1 */}
                  <div style={{ 
                    width: '40px', 
                    height: '3px', 
                    backgroundColor: currentStep >= 2 ? '#28a745' : '#dee2e6',
                    margin: '0 15px',
                    borderRadius: '2px',
                    transition: 'all 0.3s ease'
                  }}></div>
                  
                  {/* Step 2: Role Selection */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: currentStep === 2 ? '#007bff' : (currentStep > 2 ? '#28a745' : '#6c757d'),
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === 2 ? '#007bff' : (currentStep > 2 ? '#28a745' : '#dee2e6'),
                      color: currentStep >= 2 ? 'white' : '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '10px',
                      fontSize: '16px',
                      boxShadow: currentStep >= 2 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      {currentStep === 2 ? '2' : (currentStep > 2 ? '✓' : '2')}
                    </div>
                    <span>Role</span>
                  </div>

                  {/* Connector 2 */}
                  <div style={{ 
                    width: '40px', 
                    height: '3px', 
                    backgroundColor: currentStep >= 3 ? '#28a745' : '#dee2e6',
                    margin: '0 15px',
                    borderRadius: '2px',
                    transition: 'all 0.3s ease'
                  }}></div>
                  
                  {/* Step 3: Form Questions */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: currentStep === 3 ? '#007bff' : '#6c757d',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === 3 ? '#007bff' : '#dee2e6',
                      color: currentStep === 3 ? 'white' : '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '10px',
                      fontSize: '16px',
                      boxShadow: currentStep === 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      3
                    </div>
                    <span>Questions</span>
                  </div>
                </div>
              </div>
            </div>
              );
            })()}

            {/* Step 1: Year Selection */}
            {currentStep === 1 && (
              <div>
                <div className="form-section">
                  <div className="form-group">
                    <label className="form-label">
                      What year did you enter/join?
                      <span style={{ color: '#dc3545', marginLeft: '5px' }}>*</span>
                    </label>
                    
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">-- Select Year --</option>
                      {(() => {
                        const years = [2025, 2024, 2023, 2022, 2021];
                        return years.map(year => (
                          <option key={year} value={year.toString()}>
                            {year}
                          </option>
                        ));
                      })()}
                    </select>
                    
                    {selectedYear && (
                      <div style={{ 
                        marginTop: '15px', 
                        padding: '15px', 
                        backgroundColor: loadingQuestions ? '#fff3cd' : '#d4edda', 
                        borderRadius: '8px',
                        fontSize: '15px',
                        color: loadingQuestions ? '#856404' : '#155724',
                        border: `1px solid ${loadingQuestions ? '#ffeaa7' : '#c3e6cb'}`
                      }}>
                        {loadingQuestions ? (
                          <>
                            <strong>🔄 Loading questions for year {selectedYear}...</strong><br/>
                            <span style={{ fontSize: '14px' }}>
                              Please wait while we prepare your personalized questions.
                            </span>
                          </>
                        ) : (
                          <>
                            <strong>✓ Year {selectedYear} selected!</strong><br/>
                            <span style={{ fontSize: '14px' }}>
                              {conditionalQuestions.length > 0 
                                ? `${conditionalQuestions.length} questions will be shown based on your entry year.`
                                : 'Standard form questions will be displayed.'
                              }
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ marginTop: '25px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleYearNext}
                    disabled={!selectedYear || loadingQuestions}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      opacity: (!selectedYear || loadingQuestions) ? 0.6 : 1,
                      cursor: (!selectedYear || loadingQuestions) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {!selectedYear ? 'Please Select Year First' : 
                     loadingQuestions ? '🔄 Loading Questions...' :
                     `Next: Continue to Questions →`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Role Selection */}
            {currentStep === 2 && (
              <div>
                <div className="form-section">
                  <div className="form-group text-center">
                    <h3 style={{ marginBottom: '30px', color: '#333' }}>Select Your Role</h3>
                    
                    <div className="role-selection" style={{ margin: '20px 0' }}>
                      <div 
                        className={`role-option ${selectedRole === 'employee' ? 'selected' : ''}`}
                        onClick={() => handleRoleChange('employee')}
                        style={{
                          border: selectedRole === 'employee' ? '3px solid #007bff' : '2px solid #ddd',
                          borderRadius: '12px',
                          padding: '25px',
                          margin: '15px auto',
                          cursor: 'pointer',
                          backgroundColor: selectedRole === 'employee' ? '#f0f8ff' : '#f8f9fa',
                          color: '#333',
                          transition: 'all 0.3s ease',
                          maxWidth: '300px',
                          boxShadow: selectedRole === 'employee' ? '0 4px 12px rgba(0,123,255,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <h4 style={{ margin: '0 0 10px 0', color: selectedRole === 'employee' ? '#007bff' : '#333' }}>
                          👤 Employee
                        </h4>
                        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                          Fill out as a regular employee
                        </p>
                      </div>
                      
                      <div 
                        className={`role-option ${selectedRole === 'team_lead' ? 'selected' : ''}`}
                        onClick={() => handleRoleChange('team_lead')}
                        style={{
                          border: selectedRole === 'team_lead' ? '3px solid #007bff' : '2px solid #ddd',
                          borderRadius: '12px',
                          padding: '25px',
                          margin: '15px auto',
                          cursor: 'pointer',
                          backgroundColor: selectedRole === 'team_lead' ? '#f0f8ff' : '#f8f9fa',
                          color: '#333',
                          transition: 'all 0.3s ease',
                          maxWidth: '300px',
                          boxShadow: selectedRole === 'team_lead' ? '0 4px 12px rgba(0,123,255,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <h4 style={{ margin: '0 0 10px 0', color: selectedRole === 'team_lead' ? '#007bff' : '#333' }}>
                          👑 Team Lead
                        </h4>
                        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                          Fill out as a team leader
                        </p>
                      </div>

                      <div 
                        className={`role-option ${selectedRole === 'management' ? 'selected' : ''}`}
                        onClick={() => handleRoleChange('management')}
                        style={{
                          border: selectedRole === 'management' ? '3px solid #007bff' : '2px solid #ddd',
                          borderRadius: '12px',
                          padding: '25px',
                          margin: '15px auto',
                          cursor: 'pointer',
                          backgroundColor: selectedRole === 'management' ? '#f0f8ff' : '#f8f9fa',
                          color: '#333',
                          transition: 'all 0.3s ease',
                          maxWidth: '300px',
                          boxShadow: selectedRole === 'management' ? '0 4px 12px rgba(0,123,255,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <h4 style={{ margin: '0 0 10px 0', color: selectedRole === 'management' ? '#007bff' : '#333' }}>
                          👥 Management
                        </h4>
                        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                          Evaluate team members (round-robin assessment)
                        </p>
                      </div>
                    </div>

                    {loadingSections && (
                      <div style={{ 
                        marginTop: '20px', 
                        padding: '15px', 
                        backgroundColor: '#fff3cd', 
                        borderRadius: '8px',
                        border: '1px solid #ffeaa7',
                        color: '#856404'
                      }}>
                        <div className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '10px' }}>
                          <span className="sr-only">Loading...</span>
                        </div>
                        <strong>Loading sections for {selectedRole === 'employee' ? 'Employee' : selectedRole === 'team_lead' ? 'Team Lead' : 'Management'}...</strong>
                      </div>
                    )}

                    {selectedRole && !loadingSections && (
                      conditionalSections.sections && conditionalSections.sections.length > 0 ? (
                        <div style={{ 
                          marginTop: '15px', 
                          padding: '15px', 
                          backgroundColor: '#d4edda', 
                          borderRadius: '8px',
                          border: '1px solid #c3e6cb',
                          color: '#155724'
                        }}>
                          <strong>✅ Perfect! Ready to continue</strong><br/>
                          <span style={{ fontSize: '14px' }}>
                            {conditionalSections.sections.length} section(s) with {conditionalSections.questions.length} question(s) will be shown 
                            based on your year ({selectedYear}) and role ({selectedRole === 'employee' ? 'Employee' : selectedRole === 'team_lead' ? 'Team Lead' : 'Management'}).
                          </span>
                        </div>
                      ) : (
                        <div style={{ 
                          marginTop: '15px', 
                          padding: '15px', 
                          backgroundColor: '#fff3cd', 
                          borderRadius: '8px',
                          border: '1px solid #ffeaa7',
                          color: '#856404'
                        }}>
                          <strong>⚠️ No matching sections!</strong><br/>
                          <span style={{ fontSize: '14px' }}>
                            No sections match your year ({selectedYear}) and role ({selectedRole === 'employee' ? 'Employee' : selectedRole === 'team_lead' ? 'Team Lead' : 'Management'}) combination. 
                            Please try different selections or contact the form administrator.
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
                
                <div style={{ marginTop: '25px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleBackToYear}
                    className="btn btn-secondary"
                    style={{
                      padding: '12px 30px',
                      fontSize: '16px',
                      marginRight: '15px'
                    }}
                  >
                    ← Back to Year
                  </button>
                  <button
                    type="button"
                    onClick={handleRoleNext}
                    disabled={!selectedRole || loadingSections}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      opacity: (!selectedRole || loadingSections) ? 0.6 : 1,
                      cursor: (!selectedRole || loadingSections) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {!selectedRole ? 'Please Select Role First' : 
                     loadingSections ? '🔄 Loading Sections...' :
                     `Next: Continue to Questions →`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Form Questions */}
            {currentStep === 3 && (
              <form onSubmit={handleSubmit}>
                {/* Management Round-Robin Flow */}
                {isManagementFlow && managementNames.length > 0 ? (
                  <div>
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '20px', 
                      backgroundColor: '#f0f8ff', 
                      borderRadius: '8px',
                      border: '2px solid #007bff'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#007bff' }}>
                        🏢 Management Evaluation - Round-Robin Assessment
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold' }}>
                            Currently Evaluating: <span style={{ color: '#007bff' }}>{managementNames[currentPersonIndex]}</span>
                          </p>
                          <p style={{ margin: '0', fontSize: '14px', color: '#6c757d' }}>
                            Section {currentSectionForPerson + 1} of {Object.keys(getQuestionsBySections()).length} 
                            • Person {currentPersonIndex + 1} of {managementNames.length}
                            {isMultipleManagementFlow && (
                              <> • List "{selectedManagementList?.list_name}" ({currentListIndex + 1} of {managementLists.length})</>
                            )}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>
                            {isMultipleManagementFlow ? 'Overall Progress' : 'Progress'}
                          </div>
                          <div style={{ 
                            width: '100px', 
                            height: '8px', 
                            backgroundColor: '#e9ecef', 
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(() => {
                                if (isMultipleManagementFlow) {
                                  // Calculate overall progress across all management lists
                                  const totalSections = Object.keys(getQuestionsBySections()).length;
                                  const totalPeoplePerList = managementNames.length;
                                  const completedLists = currentListIndex;
                                  const currentListProgress = (currentPersonIndex * totalSections + currentSectionForPerson + 1) / (totalSections * totalPeoplePerList);
                                  const overallProgress = (completedLists + currentListProgress) / managementLists.length;
                                  return overallProgress * 100;
                                } else {
                                  // Single list progress
                                  return ((currentPersonIndex * Object.keys(getQuestionsBySections()).length + currentSectionForPerson + 1) / (Object.keys(getQuestionsBySections()).length * managementNames.length)) * 100;
                                }
                              })()}%`,
                              height: '100%',
                              backgroundColor: '#007bff',
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Render current section questions for current person */}
                    {(() => {
                      const questionsBySection = getQuestionsBySections();
                      const sectionNames = Object.keys(questionsBySection);
                      const currentSectionName = sectionNames[currentSectionForPerson];
                      const currentQuestions = questionsBySection[currentSectionName] || [];
                      
                      return (
                        <div>
                          <h3 style={{ color: '#333', marginBottom: '20px' }}>
                             Evaluating: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{managementNames[currentPersonIndex]}</span> 
                            -📂 {currentSectionName}
                          </h3>
                          <div style={{ 
                            marginBottom: '15px', 
                            padding: '10px', 
                            backgroundColor: '#f8f9fa', 
                            borderRadius: '5px',
                            fontSize: '14px',
                            color: '#6c757d'
                          }}>
                            Complete all sections for {managementNames[currentPersonIndex]} before moving to the next person
                          </div>
                          
                          {currentQuestions.map((question, qIndex) => (
                            <div key={`${question.id}_${currentPersonIndex}_${currentSectionForPerson}`} className="question-item" style={{
                              marginBottom: '25px',
                              padding: '20px',
                              border: '2px solid #e9ecef',
                              borderRadius: '8px',
                              backgroundColor: '#fff'
                            }}>
                              <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                                {qIndex + 1}. {question.question_text}
                                {question.is_required && <span style={{ color: 'red' }}> *</span>}
                              </label>
                              {renderQuestion(question)}
                            </div>
                          ))}
                          
                          {/* Navigation for Management Flow */}
                          <div style={{ 
                            marginTop: '30px', 
                            padding: '20px', 
                            backgroundColor: '#f8f9fa', 
                            borderRadius: '8px',
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <button
                              type="button"
                              onClick={handleManagementPrevious}
                              disabled={currentPersonIndex === 0 && currentSectionForPerson === 0}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '12px 20px', 
                                fontSize: '14px',
                                opacity: (currentPersonIndex === 0 && currentSectionForPerson === 0) ? 0.5 : 1
                              }}
                            >
                              ← Previous
                            </button>
                            
                            <div style={{ textAlign: 'center', fontSize: '14px', color: '#6c757d' }}>
                              {managementNames[currentPersonIndex]} - Section {currentSectionForPerson + 1}
                            </div>
                            
                            {/* Check if this is the last person in the last section of the last list */}
                            {currentPersonIndex === managementNames.length - 1 && 
                             currentSectionForPerson === Object.keys(getQuestionsBySections()).length - 1 &&
                             (!isMultipleManagementFlow || currentListIndex === managementLists.length - 1) ? (
                              <button
                                type="submit"
                                className="btn btn-success"
                                disabled={submitting}
                                style={{ 
                                  padding: '12px 30px',
                                  fontSize: '16px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {submitting ? 'Submitting...' : 'Complete Assessment 🚀'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleManagementNext}
                                className="btn btn-primary"
                                style={{ 
                                  padding: '12px 20px', 
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                Next →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* Regular Employee/Team Lead Flow */
                  <div>
                    {/* Only show role/year info if conditional logic exists */}
                    {(() => {
                      const hasYearConditions = (form.conditional_questions && form.conditional_questions.length > 0) ||
                                                (form.conditional_sections && form.conditional_sections.length > 0);
                      const hasRoleConditions = form.role_based_conditional_sections && form.role_based_conditional_sections.length > 0;
                      const hasManagementLists = form.management_lists && form.management_lists.length > 0;
                      const hasAnyConditionalLogic = hasYearConditions || hasRoleConditions || hasManagementLists;
                      
                      if (!hasAnyConditionalLogic) {
                        return null; // Don't show role/year header if no conditional logic
                      }
                      
                      return (
                        <>
                          <div style={{ 
                            marginBottom: '20px', 
                            padding: '15px', 
                            backgroundColor: '#e3f2fd', 
                            borderRadius: '8px',
                            border: '1px solid #bbdefb'
                          }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
                              📋 Form Questions - {selectedRole === 'employee' ? 'Employee' : selectedRole === 'team_lead' ? 'Team Lead' : 'Management'} ({selectedYear})
                            </h4>
                            <p style={{ margin: '0', fontSize: '14px', color: '#424242' }}>
                              Answer the questions below based on your selected role and year.
                            </p>
                          </div>

                          {/* Back Button */}
                          <div style={{ marginBottom: '20px' }}>
                            <button
                              type="button"
                              onClick={handleBackToRole}
                              className="btn btn-outline-secondary"
                              style={{ fontSize: '14px' }}
                            >
                              ← Back to Role Selection
                            </button>
                          </div>
                        </>
                      );
                    })()}

                    {/* Section-by-section navigation for regular flow */}
                    {getQuestionsToShow().length > 0 ? (
                  (() => {
                    const questionsBySection = getQuestionsBySections();
                    let sectionNames = Object.keys(questionsBySection);
                    
                    // Handle case where no sections exist
                    if (sectionNames.length === 0) {
                      const allQuestions = getQuestionsToShow();
                      if (allQuestions.length === 0) return null;
                      sectionNames = ['Form Questions'];
                    }
                    
                    const { sectionName, questions } = getCurrentSectionData();
                    
                    return (
                      <div>
                        {/* Section Progress Indicator */}
                        <div className="section-progress">
                          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                            <h4>
                              📋 Section {currentSectionIndex + 1} of {sectionNames.length}
                            </h4>
                            <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                              Complete all questions in this section to continue
                            </p>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="section-progress-bar">
                            <div 
                              className="section-progress-fill"
                              style={{
                                width: `${((currentSectionIndex + 1) / sectionNames.length) * 100}%`
                              }}
                            ></div>
                          </div>
                          
                          {/* Section Names */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {sectionNames.map((name, index) => (
                              <span key={index} style={{
                                fontWeight: index === currentSectionIndex ? 'bold' : 'normal',
                                color: index === currentSectionIndex ? '#1976d2' : '#666'
                              }}>
                                {index + 1}. {name.length > 20 ? name.substring(0, 17) + '...' : name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Current Section */}
                        <div style={{ marginBottom: '40px' }}>
                          {/* Section Header */}
                          <div className="section-header">
                            <h3 style={{
                              margin: 0,
                              color: '#495057',
                              fontSize: '24px',
                              fontWeight: '700'
                            }}>
                              {sectionName}
                            </h3>
                            <p style={{
                              margin: '8px 0 0 0',
                              color: '#6c757d',
                              fontSize: '14px'
                            }}>
                              {questions.length} question{questions.length !== 1 ? 's' : ''} in this section
                            </p>
                          </div>

                          {/* Questions in current section */}
                          {questions.map((question, index) => (
                            <div key={question.id} className="section-question">
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '16px', fontWeight: '600' }}>
                                  <span style={{ 
                                    color: '#007bff', 
                                    fontSize: '14px', 
                                    fontWeight: '500',
                                    marginRight: '8px' 
                                  }}>
                                    Q{index + 1}.
                                  </span>
                                  {form.form_type === 'assessment' ? (
                                    <div>
                                      <div style={{ marginBottom: '3px' }}>
                                        {question.question_text}
                                      </div>
                                      {question.question_text_id && (
                                        <div style={{ fontSize: '14px', color: '#6c757d', fontStyle: 'italic' }}>
                                          {question.question_text_id}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    question.question_text
                                  )}
                                  {question.is_required && (
                                    <span style={{ color: '#dc3545', marginLeft: '5px' }}>*</span>
                                  )}
                                </label>
                                
                                <div style={{ marginTop: '12px' }}>
                                  {renderQuestion(question)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="section-navigation">
                          <div>
                            {currentSectionIndex > 0 && (
                              <button
                                type="button"
                                onClick={handlePreviousSection}
                                className="btn btn-secondary"
                                style={{ padding: '12px 20px', fontSize: '14px' }}
                              >
                                ← Previous Section
                              </button>
                            )}
                          </div>
                          
                          <div style={{ flex: 1, textAlign: 'center', margin: '0 20px' }}>
                            <span style={{ fontSize: '14px', color: '#6c757d' }}>
                              Section {currentSectionIndex + 1} of {sectionNames.length}
                            </span>
                          </div>
                          
                          <div>
                            {!isLastSection() ? (
                              <button
                                type="button"
                                onClick={handleNextSection}
                                className="btn btn-primary"
                                style={{ 
                                  padding: '12px 20px', 
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                Next Section →
                              </button>
                            ) : (
                              <button
                                type="submit"
                                className="btn btn-success"
                                disabled={submitting}
                                style={{ 
                                  padding: '12px 30px',
                                  fontSize: '16px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {submitting ? 'Submitting...' : 'Submit Form 🚀'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    border: '1px solid #ffeaa7',
                    color: '#856404'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                    <h4 style={{ color: '#856404', marginBottom: '15px' }}>
                      No additional questions for year {selectedYear}
                    </h4>
                    <p style={{ marginBottom: '10px' }}>
                      Based on your entry year ({selectedYear}), there are no specific conditional questions to display.
                    </p>
                    <p style={{ marginBottom: '20px', fontSize: '14px' }}>
                      This means you have completed all required information. You can submit the form now 
                      or go back to change your year selection if needed.
                    </p>
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#fff',
                      borderRadius: '5px',
                      border: '1px solid #ffeaa7',
                      fontSize: '14px'
                    }}>
                      💡 <strong>Note:</strong> The administrator has configured this form to show different questions 
                      based on entry years, but no questions match your selected year.
                    </div>
                  </div>
                )}
                  </div>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FormFiller;