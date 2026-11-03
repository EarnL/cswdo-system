PASSING_PERCENTAGE = 75
TOTAL_MAX_SCORE = 210

ACCREDITATION_CHECKLIST = {
    'title': 'ASSESSMENT TOOL FOR THE GRANTING OF RECOGNITION TO CHILD DEVELOPMENT CENTERS/LEARNING CENTERS OFFERING EARLY CHILDHOOD PROGRAMS FOR THE 0 TO 4 YEARS OLD FILIPINO CHILDREN',
    'source': 'Guidelines on the Registration and Granting of Permit and Recognition to Public and Private CDCs/LCs, ECCD Council, September 2015',
    'passing_percentage': PASSING_PERCENTAGE,
    'total_max_score': TOTAL_MAX_SCORE,
    'recognition_levels': [
        {'level': 'Level 1', 'rating': 'Satisfactory Rating', 'score_range': '157-179', 'validity_years': 3},
        {'level': 'Level 2', 'rating': 'Very Satisfactory Rating', 'score_range': '180-200', 'validity_years': 4},
        {'level': 'Level 3', 'rating': 'Outstanding Rating', 'score_range': '201-210', 'validity_years': 5},
    ],
    'header_fields': [
        {'key': 'application_status', 'label': 'Status of Application', 'type': 'choice', 'options': ['New application', 'Re-application', 'Renewal']},
        {'key': 'source_of_funds', 'label': 'Source of Funds', 'type': 'multi_choice', 'options': ['National Government Agency (NGA)', 'Government-Owned and/or Controlled Corporation (GOCC)', 'Local Government Unit (LGU)', "People's Organization (PO)", 'Non-Government Office (NGO)', 'Private Individual', 'Others']},
        {'key': 'cdc_lc_name', 'label': 'Name of Child Development Center/Learning Center', 'type': 'text'},
        {'key': 'address', 'label': 'Address', 'type': 'text'},
        {'key': 'date_established', 'label': 'Date Established', 'type': 'date'},
        {'key': 'cdt_cdw_name_age', 'label': 'Name of Child Development Teacher/Worker and Age', 'type': 'text'},
        {'key': 'cmswdo_focal_person', 'label': 'Name of C/MSWDO/ECCD Focal Person Supervising the Program', 'type': 'text'},
        {'key': 'telephone_mobile_fax', 'label': 'Telephone/Mobile/Fax Number/s', 'type': 'text'},
        {'key': 'email_address', 'label': 'Email Address', 'type': 'text'},
        {'key': 'registration_license_no', 'label': 'Registration & License No.', 'type': 'text'},
    ],
    'sections': [{'description': 'The program promotes health, nutrition, and safety of toddlers and preschool children.',
  'id': 'health_nutrition_safety',
  'items': [{'evidence': 'DR, I ECCD Card/ Childs He alth Record Interview Notes on Childs He alth Record',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_1',
             'label': 'A written health record is maintained for each child as part of the childs individual record, '
                      'and are known and considered by the staff in the Centers activities.',
             'method': 'DR/O/I',
             'number': 1,
             'points': 1},
            {'evidence': 'DR EDDC Card Child Grow th System (CGS) Form Childs Nu tritional Status',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_2',
             'label': 'There is a record of the results of a health and nutritional status assessment by a '
                      'physician/health worker.',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'DR Immunizati GAT HERED',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_3',
             'label': 'There is a record of immunization. INDICATORS P',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'DR ECCD Car Baby Boo k Health R ecord',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_4',
             'label': 'There is a pertinent health history, such as allergies or chronic conditions of each child.',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'DR ECCD Car Childs Health Record School R ecords of Injury/M edication',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_5',
             'label': 'There is a log of medications, injury reports and health observations by a health professional.',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR Childs CDC/LC f ile of physicia ns order and prescrip tions',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_6',
             'label': 'There is a record of physicians written orders or prescriptions.',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'DR CDC/LC R Referral Immuniza tion Record',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_7',
             'label': 'Children are referred by the CDC/LC staff to an accessible Local Government '
                      'Unit (LGU) health facility or private health clinic for the provisions of vaccines under the '
                      'Expanded Program on Immunization (EPI), as mandated by the Department of Health (DOH).',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'I, DR Intervie parents as respondents ECCD Car d Baby Boo k',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_8',
             'label': 'Information and support on exclusive breastfeeding, complementary feeding with continued '
                      'breastfeeding and proper nutrition are available.',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'I, DR Intervie parents as respondents ECCD Car d Baby Boo k GA THERED',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_9',
             'label': 'Micronutrient supplementation (Vitamin A, Micronutrient Powder and Iron). INDICATORS P',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'I, DR Intervi parents as respondents ECCD Ca rd Baby Bo ok',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_10',
             'label': 'Deworming.',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'I, DR Intervi parents as respondents Dental Records ECCD Ca rd',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_11',
             'label': 'Oral health care.',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR CGS For',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_12',
             'label': 'Growth monitoring and promotion (measurement of weight, height and length).',
             'method': 'DR/O/I',
             'number': 12,
             'points': 1},
            {'evidence': 'DR CDC/LC',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_13',
             'label': 'The Center has a plan for the care of a sick child.',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'DR CDC/LC',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_14',
             'label': 'The Center has a written protocol for the care of mildly ill children to meet individual needs '
                      'for food, drink, rest and comfort.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'DR, I CDC/LC Intervi ew Notes with parents as respondents',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_15',
             'label': 'Sick children manifesting fever and rash are isolated from the rest of the learners, and '
                      'immediately sent home.',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'DR Referra GATHERING OF THE x CDC/LC Policies',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_16',
             'label': 'Staff refer the sick child to the nearest health facility for further assessment and urgent '
                      'care, if needed, while waiting to be fetched by his/her parent. INDICATORS 17. The Center has '
                      'exclusion policies for',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1},
            {'evidence': 'DR, I x Interview respon dents x Interview Notes with parents as',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_17',
             'label': 'serious illnesses, contagious diseases like colds, cough, flu, mumps, measles, etc. in '
                      'conformance with the regulations and recommendations of DOH. 18. Any Center staff who becomes '
                      'ill with',
             'method': 'DR/O/I',
             'number': 17,
             'points': 1},
            {'evidence': 'I, DR respon x CDC/LC Policies x CDC/LC Records',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_18',
             'label': 'contagious diseases are excused from contact with children as quickly as possible. 19. Parents '
                      'present a medical certificate /',
             'method': 'DR/O/I',
             'number': 18,
             'points': 1},
            {'evidence': 'DR x Medical C',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_19',
             'label': 'clearance from a public/private physician upon the return of the child to the CDC/LC. 20. The '
                      'Center has a written protocol for the',
             'method': 'DR/O/I',
             'number': 19,
             'points': 1},
            {'evidence': 'DR x CDC/LC',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_20',
             'label': 'care of malnourished children including those with special needs (underweight, stunted and '
                      'wasted), until such time that the children may be able to recover or get back to a normal '
                      'status.',
             'method': 'DR/O/I',
             'number': 20,
             'points': 1},
            {'evidence': 'DR x CDC/LC',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_21',
             'label': 'The Center has a written protocol for care of children with special needs.',
             'method': 'DR/O/I',
             'number': 21,
             'points': 1},
            {'evidence': 'I, DR x Interview x Attendanc e Sheet of Training/Orientation on Nutrit ion, Parent '
                         'Effectiveness Services, Family Development Sessions THERING OF THE x CDC/LC Re cord',
             'guideline': 'A. HEALTH AND NUTRITION SERVICES for toddlers and preschool children are made '
                          'available in coordination with the Baranga y Health',
             'id': 'health_nutrition_safety_22',
             'label': 'Parents are also provided with appropriate information and education on how to best contribute '
                      'in addressing cases of underweight, stunting, and wasting. children, conforming with the '
                      'Updated Nutritional Guidelin INDICATORS 23. The Center informs parents of the',
             'method': 'DR/O/I',
             'number': 22,
             'points': 1},
            {'evidence': 'DR x Poster of Pi Kumainmen ts/Food Pyramid x Posted Me nu',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_23',
             'label': 'nutritious foods that will be served to their young children. 24. Written menu information for '
                      'household',
             'method': 'DR/O/I',
             'number': 23,
             'points': 1},
            {'evidence': 'DR x Observation Notes/Kitchen with Storage',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_24',
             'label': 'food preparation is posted in visible areas, kept on file and provided to parents. 25. Food and '
                      'beverages are stored, prepared',
             'method': 'DR/O/I',
             'number': 24,
             'points': 1},
            {'evidence': 'O Area x Observation Notes / Foods served',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_25',
             'label': 'and served in a manner that ensures that these are free from spoilage and are safe for eating. '
                      '26. The variety of foods served to young',
             'method': 'DR/O/I',
             'number': 25,
             'points': 1},
            {'evidence': 'O, DR x Daily Men',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_26',
             'label': 'children enhances healthy eating habits and behavior, and broadens the childs food experiences.',
             'method': 'DR/O/I',
             'number': 26,
             'points': 1},
            {'evidence': 'O, DR x Observations x Daily Men u File GATHERING OF THE x Observatio n Notes/ Foods Served',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_27',
             'label': 'Food service in the Center meets individual needs and the nutritional requirements of the '
                      'children. INDICATORS 28. Foods that are high in fat, sugar and salt',
             'method': 'DR/O/I',
             'number': 27,
             'points': 1},
            {'evidence': 'O, DR x Daily M x CDC/LC Rec ords of Parents',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_28',
             'label': '(e.g. junk foods) should not be served to reduce future lifestyle-related problems in '
                      'adulthood, such as hypertension, cardiovascular disease, diabetes, obesity and dental caries. '
                      '29. Staff members are informed by parents in',
             'method': 'DR/O/I',
             'number': 28,
             'points': 1},
            {'evidence': 'DR Communi x Intake Sheet/Records x Daily F eeding Attendance',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_29',
             'label': 'writing of any special dietary and feeding needs, food allergies and vitamin supplements, from '
                      'which children are fed in accordance with parental or physician orders. 30. No young child is '
                      'denied a meal/snack for',
             'method': 'DR/O/I',
             'number': 29,
             'points': 1},
            {'evidence': 'DR x Observatio n Notes / Childrens Meals',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_30',
             'label': 'any reason other than a written medical direction. 31. Foods are served in a relaxed social',
             'method': 'DR/O/I',
             'number': 30,
             'points': 1},
            {'evidence': 'O, I x Interview respond ents',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_31',
             'label': 'atmosphere that models proper eating habits.',
             'method': 'DR/O/I',
             'number': 31,
             'points': 1},
            {'evidence': 'O, I x Observatio x Interview Notes with parents as respond ents GATHERING OF THE x '
                         'Observatio n Notes/ Childrens Meals',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_32',
             'label': 'Sufficient time is allowed for each child to eat. INDICATORS 33. Young children are encouraged '
                      'to',
             'method': 'DR/O/I',
             'number': 32,
             'points': 1},
            {'evidence': 'O, I x Interview Respond ents x Intervi ew notes/',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_33',
             'label': 'consume food according to their individual capacity; unfinished food should be brought home to '
                      'reduce food wastage. 34. Meals and snack times are social',
             'method': 'DR/O/I',
             'number': 33,
             'points': 1},
            {'evidence': 'I, O Inspect x Intervi ew notes/',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_34',
             'label': 'interactions and provide learning experiences on proper eating habits to children. 35. Young '
                      'children are encouraged without',
             'method': 'DR/O/I',
             'number': 34,
             'points': 1},
            {'evidence': 'I, O Inspect x Intervi ew Notes',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_35',
             'label': 'coercing or negative consequences to eat a well-balanced diet, and food is not used as a reward '
                      'or punishment. 36. Opportunities are provided for children to',
             'method': 'DR/O/I',
             'number': 35,
             'points': 1},
            {'evidence': 'I, O, DR x Curricu x Picture(s) of the Activity GATHERING OF THE x Inter view Notes/',
             'guideline': 'B. The Center provides FOOD, NUTRITION AND DIETARY SERVICES which promote proper NUTRITION '
                          'and HEALTHY EATING HABITS among young',
             'id': 'health_nutrition_safety_36',
             'label': 'be involved in activities related to the preparation and serving of meals, and Center staff and '
                      'these children are encouraged to eat together. INDICATORS 37. The Center promotes and '
                      'implements',
             'method': 'DR/O/I',
             'number': 36,
             'points': 1},
            {'evidence': 'I, O Prese and w ater x Obser vation Notes x Receipts from the water station',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_37',
             'label': 'proper hand washing practices for children and staff, and hand washing messages are properly '
                      'displayed in dining and toilet facilities. 38. A source of clean and sanitary drinking',
             'method': 'DR/O/I',
             'number': 37,
             'points': 1},
            {'evidence': 'O, DR x Recor x Sanit ary permit',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_38',
             'label': 'water is available to young children, and if the public or private well is used, the Center '
                      'provides evidence that the water source has been inspected and approved by an authorized '
                      'agency. 39. Foods are properly prepared in a clean',
             'method': 'DR/O/I',
             'number': 38,
             'points': 1},
            {'evidence': 'I, DR, O x Inter x Presence of clean covered containers x Observat ion Notes during '
                         'inspection x Photogra phs from the house keeping staff',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_39',
             'label': 'facility, stored in clean covered containers and served safely; if transported, these should be '
                      'in appropriate sanitary containers. 40. Non-disposable dishes, bottles, drinking',
             'method': 'DR/O/I',
             'number': 39,
             'points': 1},
            {'evidence': 'I, O',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_40',
             'label': 'and eating utensils are thoroughly washed and sanitized before use.',
             'method': 'DR/O/I',
             'number': 40,
             'points': 1},
            {'evidence': 'O x Photo THERING OF THE x Photographs',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_41',
             'label': 'All unfinished food products are disposed of properly. INDICATORS 42. All garbage containers '
                      'use are emptied',
             'method': 'DR/O/I',
             'number': 41,
             'points': 1},
            {'evidence': 'I, O x Interview No THERING OF THE x CDC Record of A ssistance from LGU/',
             'guideline': 'C. The Center ensures FOOD and WATER SAFETY and HYGIENE.',
             'id': 'health_nutrition_safety_42',
             'label': 'and cleaned daily, and are maintained in sanitary condition. INDICATORS 43. The supplementary '
                      'feeding program is',
             'method': 'DR/O/I',
             'number': 42,
             'points': 1},
            {'evidence': 'DR, I parents',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_43',
             'label': 'done in coordination with the LGU/parents.',
             'method': 'DR/O/I',
             'number': 43,
             'points': 1},
            {'evidence': 'DR, I x CDC/LC Menu Pla x Interview Notes with stakeholders as respondents GATHERING OF THE '
                         'x Minutes o f Meetings between CDC and',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_44',
             'label': 'Meals prepared for supplemental feeding are well-planned and nutritionally balanced. INDICATORS '
                      '45. The Center coordinates with the LGU/',
             'method': 'DR/O/I',
             'number': 44,
             'points': 1},
            {'evidence': 'DR, I LGU/ p x Photog raphs x List of l ocally manufactured or indigenous foods',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_45',
             'label': 'parents in promoting the use of locally manufactured and indigenous food available in the '
                      'community.',
             'method': 'DR/O/I',
             'number': 45,
             'points': 1},
            {'evidence': 'O, DR x Observati x Photog raphs x Curric ulum Guides/ Teaching -Learning Activi ties',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_46',
             'label': 'Children under supplemental feeding are provided with experiences that promote proper nutrition '
                      'and healthy eating habits.',
             'method': 'DR/O/I',
             'number': 46,
             'points': 1},
            {'evidence': 'O, I x CDC Offic counci l/ committees x List of a ctivities undertaken',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_47',
             'label': 'Children are supervised during supplementary feeding by Center staff, with the active '
                      'participation of parents.',
             'method': 'DR/O/I',
             'number': 47,
             'points': 1},
            {'evidence': 'DR x CDC Offic counci l/ committees x List of a ctivities undertaken GATHERING OF THE x '
                         'Observatio n Notes / Signage, no cigarette',
             'guideline': 'D. A SUPPLEMENTAL FEEDING PROGRAM in the Child Development Center is made available to '
                          'young children.',
             'id': 'health_nutrition_safety_48',
             'label': 'Community leaders and LGU nutrition councils/committees participate in the preparation and '
                      'conduct of supplemental feeding programs, and in monitoring and evaluating the nutritional '
                      'status of children. INDICATORS 49. The Center and its surrounding area',
             'method': 'DR/O/I',
             'number': 48,
             'points': 1},
            {'evidence': 'O butts',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_49',
             'label': 'maintain a smoke-free environment.',
             'method': 'DR/O/I',
             'number': 49,
             'points': 1},
            {'evidence': 'I, DR x Interview responde nts x Notes/Proc eedings of the drill',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_50',
             'label': 'Disaster management, including but not limited to, fire and/or earthquake drills for young '
                      'children are provided at least twice a year.',
             'method': 'DR/O/I',
             'number': 50,
             'points': 1},
            {'evidence': 'I, O x Interview responde nts x Observatio n Notes of the surroundings',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_51',
             'label': 'The Center implements environmental sanitation and hygiene.',
             'method': 'DR/O/I',
             'number': 51,
             'points': 1},
            {'evidence': 'I x Interview responde nts',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_52',
             'label': 'The Center is cleaned and maintained according to schedule.',
             'method': 'DR/O/I',
             'number': 52,
             'points': 1},
            {'evidence': 'O, I x Observatio appropri ate containers x Interview Notes with stakeholders as responde '
                         'nts GATHERING OF THE x Observat ion notes as seen during the visit',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_53',
             'label': 'Trash is stored in segregated (i.e. biodegradable and non -biodegradable) and covered disposal '
                      'containers, which are emptied daily. INDICATORS 54. All cleaning supplies are stored in a '
                      'secure',
             'method': 'DR/O/I',
             'number': 53,
             'points': 1},
            {'evidence': 'O, I x Intervie respo ndents',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_54',
             'label': 'place out of the reach of children.',
             'method': 'DR/O/I',
             'number': 54,
             'points': 1},
            {'evidence': 'I x Intervie respo ndents',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_55',
             'label': 'Major housekeeping and repair activities are conducted when children are not around.',
             'method': 'DR/O/I',
             'number': 55,
             'points': 1},
            {'evidence': 'I, DR x Intervie respo ndents x CDC/LC P olicy/Record for reporting injur ies, accidents',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_56',
             'label': 'The Center has a procedure for reporting injuries, accidents or problems that may occur that '
                      'require rapid response on the part of the staff.',
             'method': 'DR/O/I',
             'number': 56,
             'points': 1},
            {'evidence': 'DR x CDC/LC L Probl ems/Injuries',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_57',
             'label': 'Individual medical problems and injuries that require medical attention other than minor first '
                      'aid are recorded and reported to the parents immediately.',
             'method': 'DR/O/I',
             'number': 57,
             'points': 1},
            {'evidence': 'I x Intervie prese nce of phone GATHERING OF THE',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_58',
             'label': 'At least one telephone or cell phone is made available on the school premises for this purpose. '
                      'INDICATORS',
             'method': 'DR/O/I',
             'number': 58,
             'points': 1},
            {'evidence': 'DR x CDC/LC',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_59',
             'label': 'Availability of an injury log that includes the name of child; date, time and location of the '
                      'accident; description of the injury and how it occurred; the treatment given and the name of '
                      'the person who gave the treatment, and names of witnesses.',
             'method': 'DR/O/I',
             'number': 59,
             'points': 1},
            {'evidence': 'DR x Interv pre sence of first aid kit x CDC/LC Log book of first aid treatments',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_60',
             'label': 'The staff administer the basic first aid treatment in cases of slight injuries/bruises.',
             'method': 'DR/O/I',
             'number': 60,
             'points': 1},
            {'evidence': 'O, I x Observ aid kit x Interv iew Notes with stakeholders on the pre sence of first aid kit',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_61',
             'label': 'A first aid kit is available at all times in the Center and is replenished as often as '
                      'necessary.',
             'method': 'DR/O/I',
             'number': 61,
             'points': 1},
            {'evidence': 'I, DR x Interv res pondents x CDC/LC Policies GATHERING OF THE',
             'guideline': 'E. The Center implements a CLEAN AND SAFE ENVIRONMENT and INJURY PREVENTION program among '
                          'young children and staff.',
             'id': 'health_nutrition_safety_62',
             'label': 'There are procedures for injury prevention and management of medical emergencies during field '
                      'trips. The Center ensures that a first aid kit and list of emergency numbers for the children '
                      'are available on any field trip. INDICATORS',
             'method': 'DR/O/I',
             'number': 62,
             'points': 1},
            {'evidence': 'DR, I x CDC/LC P x Intervie w Notes with stakeholders as respo ndents',
             'guideline': 'F. The Center implements a CHILD PROTECTION PROGRAM.',
             'id': 'health_nutrition_safety_63',
             'label': 'Child protection is ensured at all times in the Center.',
             'method': 'DR/O/I',
             'number': 63,
             'points': 1},
            {'evidence': 'DR x CDC/LC R Abuse and Neglect',
             'guideline': 'F. The Center implements a CHILD PROTECTION PROGRAM.',
             'id': 'health_nutrition_safety_64',
             'label': 'The Center facilitates the conduct of child protection seminars related to child abuse and '
                      'neglect, with the participation of parents and authorized caregivers. Written procedures are '
                      'available for protecting children against abuse and neglect.',
             'method': 'DR/O/I',
             'number': 64,
             'points': 1},
            {'evidence': 'DR x CDC/LC R Certi ficates earned from training',
             'guideline': 'F. The Center implements a CHILD PROTECTION PROGRAM.',
             'id': 'health_nutrition_safety_65',
             'label': 'The staff receives training regarding policies, procedures, and legal and professional '
                      'responsibilities about reporting suspected child abuse/neglect.',
             'method': 'DR/O/I',
             'number': 65,
             'points': 1},
            {'evidence': 'DR x CDC/LC W',
             'guideline': 'F. The Center implements a CHILD PROTECTION PROGRAM.',
             'id': 'health_nutrition_safety_66',
             'label': 'The Center cooperates in the investigation of child abuse/neglect, including identifying '
                      'parents of those currently or previously enrolled in the Center, disclosure of information to '
                      'any authorized person for the investigation of the allegation and protection of children, if '
                      'applicable.',
             'method': 'DR/O/I',
             'number': 66,
             'points': 1}],
  'max_score': 66,
  'minimum_score': 49,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'I. Health, Nutrition, and Safety'},
 {'description': 'Physical environment and safety requirements for indoor and outdoor child-friendly learning areas.',
  'id': 'physical_environment_safety',
  'items': [{'evidence': 'O Observati access to outdoor play and equip ment',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_1',
             'label': 'The Center maintains or has access to an outdoor play area accessible to young children, '
                      'including those with special needs. Adequate space is provided with play equipment, and '
                      'sufficient quantity and variety appropriate to the needs and ages of the young children.',
             'method': 'DR/O/I',
             'number': 1,
             'points': 1},
            {'evidence': 'O Observati the kind of fence',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_2',
             'label': 'The play area is fenced by a non -climbable barrier or is contained by natural barriers.',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'O Observati hazards GATHERED',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_3',
             'label': 'The area is free from hazards, including but not limited to busy street, poisonous plants, '
                      'water hazards, debris, broken glass and dangerous machinery or tools. INDICATORS',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'O Ob av ailable equipment',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_4',
             'label': 'There are equipment available that encourage active physical play and quiet play activities.',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'O Ob on safety of play eq uipment',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_5',
             'label': 'All play equipment are constructed and installed in such a manner as to be safe for use by '
                      'children.',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR, I Ce Ma intenance Record In terview Notes wi th stakeholders as re spondents',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_6',
             'label': 'Play area and equipment are inspected and regularly maintained in good condition and in good '
                      'repair.',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'O Ob',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_7',
             'label': 'Play area is clearly visible to staff members at all times. There is a shaded area or '
                      'protection from direct sunlight in the outdoor play area and pathways are clear for emergency '
                      'evacuation and accessible to individuals.',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'O, I Ob Cl assroom Activities In terview Notes with pa rents as respondents GATHERED',
             'guideline': 'A. The OUTDOOR PLAY AREA is safely maintained and encourages play and learning.',
             'id': 'physical_environment_safety_8',
             'label': 'The staff check childrens clothing to be sure it is appropriate for playground safety. '
                      'INDICATORS',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'O, DR Obser safet y and cleanliness Certi ficate of Pest Contr ol/Photographs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_9',
             'label': 'The classroom environment is safe, clean and maintained free from pests.',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'O Obser adequ ate space',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_10',
             'label': 'There is an adequate space for classroom activities exclusive of lockers, bathrooms, closets '
                      'and areas regularly used for other purposes.',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'O Obser',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_11',
             'label': 'All areas are well lighted and ventilated.',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'O Obser',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_12',
             'label': 'Bulletin boards have updated content that match with the calendar of activities and other '
                      'important announcements.',
             'method': 'DR/O/I',
             'number': 12,
             'points': 1},
            {'evidence': 'O Obser',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_13',
             'label': 'Floors are clean, non -slippery, smooth and free from other safety hazards.',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'O Obser',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_14',
             'label': 'Windows and doors are constructed to prevent injury to children.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'O Obser GATHERED',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_15',
             'label': 'The door for entry and exit can be opened inward and outward, but not swinging. INDICATORS',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'O, I Obs Int erview Notes wit h stakeholders as res pondents',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_16',
             'label': 'Ceiling and walls are maintained in good repair, and walls are free from lead paints/toxic '
                      'materials.',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1},
            {'evidence': 'O Obs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_17',
             'label': 'All hazardous materials and substances are kept out of the reach of children.',
             'method': 'DR/O/I',
             'number': 17,
             'points': 1},
            {'evidence': 'O Obs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_18',
             'label': 'Classrooms have a well-stocked First Aid Kit to respond effectively to common injuries.',
             'method': 'DR/O/I',
             'number': 18,
             'points': 1},
            {'evidence': 'O Obs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_19',
             'label': 'All containers are labeled with contents, especially when not in their original containers in '
                      'order to facilitate the identification of substances.',
             'method': 'DR/O/I',
             'number': 19,
             'points': 1},
            {'evidence': 'O Obs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_20',
             'label': 'All classroom electrical cords and unused electrical outlets are covered for childrens safety.',
             'method': 'DR/O/I',
             'number': 20,
             'points': 1},
            {'evidence': 'O Obs',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_21',
             'label': 'Equipment or materials for fire prevention and management (e.g. fire extinguishers, bags of '
                      'sand, covered pails of water) are available.',
             'method': 'DR/O/I',
             'number': 21,
             'points': 1},
            {'evidence': 'O, I Obs Int erview Notes wit h stakeholders as res pondents GATHE RED',
             'guideline': 'B. The CENTERS ENVIRONMENT is safely maintained, and encourages play and learning.',
             'id': 'physical_environment_safety_22',
             'label': 'Flammable materials, if there are any, are stored separately from the Center. INDICATORS POI',
             'method': 'DR/O/I',
             'number': 22,
             'points': 1},
            {'evidence': 'O Observatio',
             'guideline': 'C. There is a defined CLASSROOM ARRANGEMENT that offers appropriate play and storage areas.',
             'id': 'physical_environment_safety_23',
             'label': 'Indoor play areas are defined clearly by spatial arrangement.',
             'method': 'DR/O/I',
             'number': 23,
             'points': 1},
            {'evidence': 'O Observatio',
             'guideline': 'C. There is a defined CLASSROOM ARRANGEMENT that offers appropriate play and storage areas.',
             'id': 'physical_environment_safety_24',
             'label': 'Space is subdivided into areas so that young children can play individually, together and in '
                      'small groups and in a large group, and to accommodate the variety of activities contained in '
                      'the curriculum.',
             'method': 'DR/O/I',
             'number': 24,
             'points': 1},
            {'evidence': 'O Observatio GATHE RED',
             'guideline': 'C. There is a defined CLASSROOM ARRANGEMENT that offers appropriate play and storage areas.',
             'id': 'physical_environment_safety_25',
             'label': 'Manipulative learning materials for play area are accessible to children. INDICATORS POI',
             'method': 'DR/O/I',
             'number': 25,
             'points': 1},
            {'evidence': 'O, I Observatio Interview Notes with parents as respondents GATHERED',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_26',
             'label': 'The Center uses materials/toys that are appropriate to childrens age and stage of development, '
                      'reflecting a wide variety of family backgrounds. INDICATORS',
             'method': 'DR/O/I',
             'number': 26,
             'points': 1},
            {'evidence': 'O Ob',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_27',
             'label': 'The Center provides an adequate variety of play/manipulative learning materials/educational '
                      'toys, furniture and equipment for the size of the group, categorized as follows: Furniture, '
                      'Fixtures and Other Accessories that are expected to make the learning space comfortable and '
                      'attractive to children while assuring their safety and protection.',
             'method': 'DR/O/I',
             'number': 27,
             'points': 1},
            {'evidence': 'O, I Ob us e of story books, po sters and AV ma terials In terview Notes with pa rents as '
                         'respondents',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_28',
             'label': 'Age-appropriate Story Books, Posters and Audio-Video Materials that promote independent '
                      'learning.',
             'method': 'DR/O/I',
             'number': 28,
             'points': 1},
            {'evidence': 'O, I Ob on the use of musical in struments In terview Notes with pa rents as respondents',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_29',
             'label': 'Musical Instruments to introduce young children to sounds and encourage them to sing, hum or '
                      'whistle to themselves; to see patterns in music and nature, to be sensitive to environmental '
                      'sounds as well as to human voice.',
             'method': 'DR/O/I',
             'number': 29,
             'points': 1},
            {'evidence': 'O, I, DR Ob ac tivities for Arts and Cr afts In terview Notes with pa rents as respondents '
                         'Ch ildrens Outputs on Ar ts and Crafts GATHERING GATHERED OF THE REMARKS',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_30',
             'label': 'Arts and Crafts to stimulate childrens curiosity towards the development of their own artistic '
                      'and creative ability. INDICATORS',
             'method': 'DR/O/I',
             'number': 30,
             'points': 1},
            {'evidence': 'O, I Obse hygi ene, toilet and hand wash ing facilities Inte rview Notes with pare nts as '
                         'respondents',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_31',
             'label': 'Hygiene, Toilet and Hand washing facilities for teaching and learning proper hygiene and '
                      'cleanliness so children could experience the development of health habits through '
                      'demonstration. Access to safe clean water for drinking, hand washing and tooth brushing inside '
                      'or within the Center. Availability of water for flushing of toilets and general use inside or '
                      'within the premises of the Center. Group hand washing facilities that can accommodate at least '
                      'five (5) children at a time with proper roofing and safe access if outside the Center. Proper '
                      'drainage for waste water.',
             'method': 'DR/O/I',
             'number': 31,
             'points': 1},
            {'evidence': 'O, I Obse cont ents Inte rview Notes with pare nts as respondents GA THERED',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_32',
             'label': 'The contents are of sufficient quantity for the number of children enrolled at any time, and '
                      'are arranged to promote independent use. INDICATORS P',
             'method': 'DR/O/I',
             'number': 28,
             'points': 1},
            {'evidence': 'O Observa proper labeling of the content s',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_33',
             'label': 'The contents that require teachers supervision are stored out of childrens reach.',
             'method': 'DR/O/I',
             'number': 29,
             'points': 1},
            {'evidence': 'O Observa furnitu re, fixtures and equipme nt',
             'guideline': 'D. There is a variety of CONTENTS (Facilities, Equipment and Instructional Materials) that '
                          'are safely maintained.',
             'id': 'physical_environment_safety_34',
             'label': 'All furniture and fixtures, equipment and learning materials are clean, safe, in workable '
                      'condition and are not hazardous to young children.',
             'method': 'DR/O/I',
             'number': 30,
             'points': 1}],
  'max_score': 34,
  'minimum_score': 25,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'II. Physical Environment and Safety'},
 {'description': 'Interactions and relationships between staff and children, among children, and with other adults.',
  'id': 'interactions_relationships',
  'items': [{'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides/ Teaching - Learning Activiti es',
             'guideline': 'A. There are opportunities for PEER INTERACTIONS and RELATIONSHIPS.',
             'id': 'interactions_relationships_1',
             'label': 'Young children are given opportunities to choose and interact with a variety of materials and '
                      'activities in which they can play independently or with other peers, with or without the '
                      'supervision of the teacher/ Child Development Specialist or other staff members.',
             'method': 'DR/O/I',
             'number': 1,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides/ Teaching -Learning Activiti es '
                         'GATHERED',
             'guideline': 'A. There are opportunities for PEER INTERACTIONS and RELATIONSHIPS.',
             'id': 'interactions_relationships_2',
             'label': 'Children are comfortable, relaxed and happy while busily involved in playing with peers, with '
                      'the materials and/or engaged in other activities and self-help tasks. INDICATORS',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'O Obser Commu nication Excha nges',
             'guideline': 'B. There are POSITIVE STAFF AND CHILD INTERACTIONS AND RELATIONSHIPS.',
             'id': 'interactions_relationships_3',
             'label': 'The staff greet young children and parents warmly in a friendly and courteous manner.',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'O Obser',
             'guideline': 'B. There are POSITIVE STAFF AND CHILD INTERACTIONS AND RELATIONSHIPS.',
             'id': 'interactions_relationships_4',
             'label': 'The staff assist and encourage cooperation and responsible behaviors among children.',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'O Obser Class room Activities',
             'guideline': 'B. There are POSITIVE STAFF AND CHILD INTERACTIONS AND RELATIONSHIPS.',
             'id': 'interactions_relationships_5',
             'label': 'The staff encourage children to delve into activities, share experiences, ideas and feelings, '
                      'and assist them in dealing with emotions such as anger, sadness and frustration, by comforting '
                      'and helping them to solve their problems.',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'O Obser Class room Activities GAT HERED',
             'guideline': 'B. There are POSITIVE STAFF AND CHILD INTERACTIONS AND RELATIONSHIPS.',
             'id': 'interactions_relationships_6',
             'label': 'The staff meaningfully interact and talk with young children using their mother tongue, and are '
                      'responsive to each childs individual and special needs, temperaments, learning styles and '
                      'interests. INDICATORS P',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'O Observat Classroo m Activities',
             'guideline': 'C. STAFF interact FAIRLY AND EQUITABLY with young children and adults.',
             'id': 'interactions_relationships_7',
             'label': 'The staff treat children and adults with equal respect, regardless of gender, race, age, '
                      'language, religion, culture and family background.',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guide/ Teaching -Learning Activiti es GAT '
                         'HERED',
             'guideline': 'C. STAFF interact FAIRLY AND EQUITABLY with young children and adults.',
             'id': 'interactions_relationships_8',
             'label': 'The staff provides all children, including those with special needs, with equal opportunities '
                      'to take part in their activities to be able to interact according to their capabilities. '
                      'INDICATORS P',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides/ Teaching -Learning Activiti es GATH '
                         'ERED',
             'guideline': 'D. The STAFF nurture childrens INDEPENDENCE AND COMPETENCE.',
             'id': 'interactions_relationships_9',
             'label': 'The staff provide opportunities for children to develop self-help, problem-solving and '
                      'decision- making skills, such as dressing and undressing, personal hygiene and using eating '
                      'utensils appropriately with adjustment for children with special needs, fine and motor skills, '
                      'cognitive, aesthetic arts and language development. INDICATORS PO',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'O, DR Observati Classroom Activities Curriculu m Guides/ Teaching- Learning Activitie s GATH '
                         'ERED',
             'guideline': 'D. The STAFF nurture childrens INDEPENDENCE AND COMPETENCE.',
             'id': 'interactions_relationships_10',
             'label': 'They provide developmentally appropriate materials and equipment, arranged in a manner that is '
                      'visible and readily accessible to children so that children including those with special needs '
                      'may select, remove and replace the materials independently or with minimum assistance. '
                      'INDICATORS PO',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'DR Observati Classroom Activities Curriculu m Guides/ Teaching- Learning Activitie s',
             'guideline': 'E. Childrens BEHAVIORS are managed in a positive manner.',
             'id': 'interactions_relationships_11',
             'label': 'The program has written statements defining the rules, policies and procedures for the behavior '
                      'management of three (3) to four (4) year old children, directed towards the goal of maximizing '
                      'their growth and development, and protecting the group and individuals within it.',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR Policy Do Minutes of PTA/ PTCA Meetings GATHERED',
             'guideline': 'E. Childrens BEHAVIORS are managed in a positive manner.',
             'id': 'interactions_relationships_12',
             'label': 'The rules and procedures are posted in a noticeable place and provided to and discussed with '
                      'parents during Parents Teachers Association/Parents Teachers and Community meetings. INDICATORS',
             'method': 'DR/O/I',
             'number': 12,
             'points': 1},
            {'evidence': 'O, DR Obse Clas sroom Activities Curr iculum Guides/ Teac hing-Learning Acti vities',
             'guideline': 'E. Childrens BEHAVIORS are managed in a positive manner.',
             'id': 'interactions_relationships_13',
             'label': 'The program uses positive behavior management techniques, such as setting reasonable and '
                      'positive expectations, offering choices and providing children an opportunity to verbalize '
                      'their feelings, which encourage children to develop self -control through understanding.',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'O, DR Obse Clas sroom Activities Curr iculum Guides/ Teac hing-Learning Acti vities',
             'guideline': 'E. Childrens BEHAVIORS are managed in a positive manner.',
             'id': 'interactions_relationships_14',
             'label': 'The program is designed to promote positive behavioral techniques (i.e. modeling, redirection, '
                      'positive reinforcement and encouragement) that are discussed and practiced consistently among '
                      'staff in a reasonable and appropriate manner.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'O, DR -Obs Post ed Classroom Daily Sche dule-Curriculum Guid es/Teaching- Lear ning '
                         'Activities',
             'guideline': 'E. Childrens BEHAVIORS are managed in a positive manner.',
             'id': 'interactions_relationships_15',
             'label': 'Self-discipline is encouraged among children and parents, following the Centers arrangement and '
                      'daily schedule, and allowing children to resolve their own conflicts as appropriate.',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1}],
  'max_score': 15,
  'minimum_score': 11,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'III. Interactions and Relationships Between Staff and Children, Among Children and Other Adults'},
 {'description': 'Staff qualifications, staff development, and continuing education requirements.',
  'id': 'staff_qualifications_development',
  'items': [{'evidence': 'Transcript of Records',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and ADMINISTRATIVE STAFF.',
             'id': 'staff_qualifications_development_1',
             'label': "The Child Development Teacher (CDT) has a Bachelor's Degree in Childhood Education or "
                      'Elementary Education preferably with specialization on Early Childhood or any degree related to '
                      'Education like Psychology, Child Study, Family Life and Child Development, among others.',
             'method': 'DR',
             'number': 1,
             'points': 1},
            {'evidence': 'DR Certi',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_2',
             'label': 'b. attended basic trainings or seminars related to Early Childhood Care and Development (ECCD) '
                      'or Early Childhood Education (ECE)',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'DR, O Perso Resum e Obser vation Notes on oral communication',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_3',
             'label': 'c. skills in community mobilization and effective oral communication, and preferably one who is '
                      'computer literate;',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'DR Perso Sheet /Resume',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_4',
             'label': 'd. experience in working with children;',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'I Inter with stakeholders as recip ients',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_5',
             'label': 'e. demonstrated love for children; and',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR Baran NBI C learance Three (3) Character Refer ences',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_6',
             'label': 'f. a Barangay Certificate/NBI Clearance with three (3) Character References. 2. The Child '
                      'Development Worker (CDW)',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'DR Trans',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_7',
             'label': 'a. A Bachelors Degree in any field;',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'DR Certi GATHERED',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_8',
             'label': 'b. Completed basic trainings or seminars related to Early Childhood Care and Development or '
                      'Early Childhood Education; INDICATORS',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'DR, O Pers Resu me Obse rvation Notes on oral communication',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_9',
             'label': 'c. Skills in community mobilization and effective oral communication;',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'DR Pers Resu me',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_10',
             'label': 'd. experienced working with children;',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'I Inte with stakeholders as reci pients',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_11',
             'label': 'e. demonstrated love for children; and',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR Bara NBI Clearance Thre e (3) Character Refe rences',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_12',
             'label': 'f. a Barangay Certificate/NBI Clearance with three (3) Character References. 3. The Teacher '
                      'Aide has:',
             'method': 'DR/O/I',
             'number': 12,
             'points': 1},
            {'evidence': 'DR High',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_13',
             'label': 'a. At least completed the Secondary level;',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'DR Cert',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_14',
             'label': 'b. Attended orientations related to health, nutrition, early education, social services and '
                      'other related topics;',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'DR Pers Shee t/Resume',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_15',
             'label': 'c. Experience in working with children;',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'I Inte with stakeholders as reci pients GATHERING OF THE',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_16',
             'label': 'd. Demonstrated love for children; and INDICATORS',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1},
            {'evidence': 'DR x Bara x Three ( 3) Character References',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_17',
             'label': 'e. Barangay Certificate/NBI Clearance and three (3) Character References. 4. The Center Focal '
                      'Person/Administrator/Director/Principal has:',
             'method': 'DR/O/I',
             'number': 17,
             'points': 1},
            {'evidence': 'DR x Certifi',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_18',
             'label': 'a. A minimum of one year classroom experience or relevant experience;',
             'method': 'DR/O/I',
             'number': 18,
             'points': 1},
            {'evidence': 'DR x Certifi',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_19',
             'label': 'b. Bachelors Degree with units in administration/management and supervision; and',
             'method': 'DR/O/I',
             'number': 19,
             'points': 1},
            {'evidence': 'O x Observa',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_20',
             'label': 'c. Computer literacy skills.',
             'method': 'DR/O/I',
             'number': 20,
             'points': 1},
            {'evidence': 'DR x Transcr the Institution',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_21',
             'label': 'Other Administrative staff in the private CDC/LC meet the required educational qualification of '
                      'their position. 6. The other important requirements for the staff are: They should preferably '
                      'be between 18 -45',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR, I x Birt x Intervi ew Notes with stakeholder',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_22',
             'label': 'years of age and/or has the necessary required physical stamina to attend to early learners;',
             'method': 'DR/O/I',
             'number': 22,
             'points': 1},
            {'evidence': 'DR x Medi x Certifi cation from the Barangay Captain/',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_23',
             'label': 'Have good physical and stable emotional condition; and',
             'method': 'DR/O/I',
             'number': 23,
             'points': 1},
            {'evidence': 'DR City GATH ERED',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_24',
             'label': 'Have good moral character. INDICATORS PO 7. The program is in compliance with the requirements '
                      'for volunteers and student interns.',
             'method': 'DR/O/I',
             'number': 24,
             'points': 1},
            {'evidence': 'DR Letter fr Instituti on Centers Policy on Volunteer s/Student Interns',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_25',
             'label': 'Volunteers and student interns are chosen for their ability to meet the needs of the young '
                      'children in care, and are provided with appropriate orientation, training and supervision.',
             'method': 'DR/O/I',
             'number': 25,
             'points': 1},
            {'evidence': 'DR Center Re of arrang ement with Instituti on GATH ERED',
             'guideline': 'A. There are common REQUIREMENTS for CHILD DEVELOPMENT TEACHERS (CDTs)/ WORKERS (CDWs), '
                          'TEACHER AIDES and',
             'id': 'staff_qualifications_development_26',
             'label': 'The program has a written description of any arrangement with the specific responsibilities of '
                      'volunteers, and with a school or college in the case of student interns. INDICATORS PO',
             'method': 'DR/O/I',
             'number': 26,
             'points': 1},
            {'evidence': 'DR Certifica Manual/ H andbook/ Brochure on Operations and Guide lines GATHERED',
             'guideline': 'B. Staff development provides opportunities for professional growth and continuing '
                          'education.',
             'id': 'staff_qualifications_development_27',
             'label': 'The Child Development Teachers/Workers are given orientation on the operations and guidelines '
                      'of the CDC/LC. INDICATORS',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'DR Pro Dev elopment Program/ Lis t of Trainings to be Con ducted Rep ort on Trainings Con '
                         'ducted Cer tificates of Trainings rec eived by the staff',
             'guideline': 'B. Staff development provides opportunities for professional growth and continuing '
                          'education.',
             'id': 'staff_qualifications_development_28',
             'label': 'There is a regular and continuous training program based on a training needs assessment, which '
                      'provides CDTs/CDWs opportunities to enhance their skills and strengthen their values that '
                      'include but are not limited to: working with children and families with diverse and special '
                      'needs; conducting assessment and appropriate intervention for childrens progress; mentorship of '
                      'parents on the care and education of young children; laws on child protection and development; '
                      'and current trends and strategies in early childhood education.',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'DR Cop Reg istration Forms of sta ff in Institutions- Tra nscript of Records Lis t of '
                         'Trainings/ Sem inars/Workshops att ended Cer tificates of Trainings rec eived by the staff',
             'guideline': 'B. Staff development provides opportunities for professional growth and continuing '
                          'education.',
             'id': 'staff_qualifications_development_29',
             'label': 'The management provides opportunities for CDTs/CDWs to gain professional and personal growth in '
                      'a variety of modes (e.g. enrollment in colleges, online training, special courses, etc.) and '
                      'through mentoring, classroom observations, visits to Early Childhood Education programs, and '
                      'attendance at conferences and workshops, among other events, and documentation on these are '
                      'kept on file.',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'DR Cop Reg istration Forms of sta ff in Institutions Tra nscript of Records G ATHERED',
             'guideline': 'B. Staff development provides opportunities for professional growth and continuing '
                          'education.',
             'id': 'staff_qualifications_development_30',
             'label': 'CDTs/CDWs have initiatives to pursue further studies to improve their own skills in providing '
                      'quality education for children under their care. INDICATORS 12. There is a regular performance '
                      'appraisal conducted by the supervisor that follows a standard procedure:',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR Center meetin gs/conferences with s taff on curriculum implem entation',
             'guideline': 'C. There is a system of personnel appraisal and the provision of incentives for excellent '
                          'performance.',
             'id': 'staff_qualifications_development_31',
             'label': 'Planning with the staff for the implementation of the curriculum;',
             'method': 'DR/O/I',
             'number': 31,
             'points': 1},
            {'evidence': 'DR Center Meetin g Reports on progra m implementation',
             'guideline': 'C. There is a system of personnel appraisal and the provision of incentives for excellent '
                          'performance.',
             'id': 'staff_qualifications_development_32',
             'label': 'Quarterly meetings or observations of actual instruction to follow up program implementation '
                      'and provide technical assistance; and',
             'method': 'DR/O/I',
             'number': 32,
             'points': 1},
            {'evidence': 'DR, I Superv Perfor mance Appraisal Report of Staff',
             'guideline': 'C. There is a system of personnel appraisal and the provision of incentives for excellent '
                          'performance.',
             'id': 'staff_qualifications_development_33',
             'label': 'Feedback for the improvement of staff performance.',
             'method': 'DR/O/I',
             'number': 33,
             'points': 1},
            {'evidence': 'DR Center Files of Certificates of Apprec iation/ Awards Given',
             'guideline': 'C. There is a system of personnel appraisal and the provision of incentives for excellent '
                          'performance.',
             'id': 'staff_qualifications_development_34',
             'label': 'There is a rewards mechanism to encourage innovation and excellent performance.',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'DR Center Employ ee Manual on Promot ion',
             'guideline': 'C. There is a system of personnel appraisal and the provision of incentives for excellent '
                          'performance.',
             'id': 'staff_qualifications_development_35',
             'label': 'There are opportunities for advancement in position and compensation.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1}],
  'max_score': 35,
  'minimum_score': 26,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'IV. Staff Qualifications, Staff Development and Continuing Education'},
 {'description': 'Curriculum, instruction, assessment, routines, and child development learning opportunities.',
  'id': 'curriculum_instruction_assessment',
  'items': [{'evidence': 'DR Assessment R Curriculum G uides/ Teaching-Lea rning Activities Samples of c hildrens work '
                         'GATHERED',
             'guideline': 'A. The curriculum is carefully PLANNED to appropriately respond to the DEVELOPMENTAL NEEDS '
                          'of every young child in the Center .',
             'id': 'curriculum_instruction_assessment_1',
             'label': 'The curriculum is based on information derived from a variety of sources about children in the '
                      'three (3) and four (4) years age group in the six domains: physical health, well-being and '
                      'motor development, social- emotional development, character and values development, cognitive '
                      'and intellectual development, language development, and creative and aesthetic development. '
                      'INDICATORS',
             'method': 'DR/O/I',
             'number': 1,
             'points': 1},
            {'evidence': 'DR C T eaching-Learning A ctivities T eacher-made/prepared m aterials that support c '
                         'urriculum activities ( e.g. experience charts, g rowth charts, calendar) O bservation Notes/ '
                         'S amples of childrens w ork',
             'guideline': 'A. The curriculum is carefully PLANNED to appropriately respond to the DEVELOPMENTAL NEEDS '
                          'of every young child in the Center .',
             'id': 'curriculum_instruction_assessment_2',
             'label': 'Curriculum goals, objectives and activities are based on the individual needs and interests of '
                      'the young children, allowing for a range of activities that provide them early stimulations for '
                      'active involvement in the learning process through play, concrete experiences and the '
                      'exploration of the environment whether in individual, small group or whole group settings.',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'DR, O C T eaching-Learning A ctivities',
             'guideline': 'A. The curriculum is carefully PLANNED to appropriately respond to the DEVELOPMENTAL NEEDS '
                          'of every young child in the Center .',
             'id': 'curriculum_instruction_assessment_3',
             'label': 'The staff discusses the curriculum plan for individual childrens needs, offering choices of '
                      'activities with parents. Written plans show teacher-initiated and child-initiated activities '
                      'that are developmentally appropriate in individual, small group and whole group settings.',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'DR C T eaching-Learning A ctivities G uides for Adaptations/ M odifications/ I ndividualized '
                         'Education P lan (IEP) GATHERED',
             'guideline': 'A. The curriculum is carefully PLANNED to appropriately respond to the DEVELOPMENTAL NEEDS '
                          'of every young child in the Center .',
             'id': 'curriculum_instruction_assessment_4',
             'label': 'Group time and activity center plans indicate adaptations/modifications necessary for '
                      'facilitating young children with disabilities or children with special needs to meet their '
                      'learning goals and objectives. INDICATORS',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'O Obser Adequ ate space/areas in th e classroom Prese nce of materials and e quipment that '
                         'suppo rt curriculum activ ities',
             'guideline': 'B. The curriculum is PLAY -BASED and provides space for a variety of CHILD -INITIATED and '
                          'ADULT -FACILITATED learning opportunities.',
             'id': 'curriculum_instruction_assessment_5',
             'label': 'Activity areas are provided to accommodate and encourage activities that are congruent with the '
                      'curriculum, and are equipped with manipulative and interactive materials and equipment that are '
                      'readily accessible to promote concrete and interactive learning, and to encourage peer '
                      'interactions.',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'O Obser Prese nce of space for i ndoor & outdoor activ ities Time schedule posted',
             'guideline': 'B. The curriculum is PLAY -BASED and provides space for a variety of CHILD -INITIATED and '
                          'ADULT -FACILITATED learning opportunities.',
             'id': 'curriculum_instruction_assessment_6',
             'label': 'Both indoor and outdoor time and space are available for active physical and motor activities, '
                      'quiet play and play that fosters development of values such as respect, empathy, care, '
                      'cooperation and self -esteem.',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'O Obser Areas are accessible for CSNs GA THERED',
             'guideline': 'B. The curriculum is PLAY -BASED and provides space for a variety of CHILD -INITIATED and '
                          'ADULT -FACILITATED learning opportunities.',
             'id': 'curriculum_instruction_assessment_7',
             'label': 'Activity areas are accessible and are adapted to accommodate young children with special needs '
                      '(CSNs). Creative Expression and Arts Appreciation. INDICATORS P',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'DR, O Curricu Teachin g-Learning Activit ies Observa tion Notes/ Classro om Activities',
             'guideline': 'C. The curriculum develops CONCEPTS and VALUES in Health and Safety, Literacy, Numeracy, '
                          'Science, Social Studies, Technology,',
             'id': 'curriculum_instruction_assessment_8',
             'label': 'The curriculum integrates concepts that promote healthy life among young children, such as but '
                      'not limited to water, sanitation, hygiene and safety.',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'DR, O Curricu Teachin g-Learning Activit ies Observa tion Notes/ Classro om Activities '
                         'Samples of childrens work Presence o f teacher- made/pr epared materia ls that support '
                         'curricu lum activities GATHER ED',
             'guideline': 'C. The curriculum develops CONCEPTS and VALUES in Health and Safety, Literacy, Numeracy, '
                          'Science, Social Studies, Technology,',
             'id': 'curriculum_instruction_assessment_9',
             'label': 'Experiences are provided for language and literacy development, development of mathematical '
                      'concepts, development of scientific concepts, self -expression in art, music, movement and '
                      'dance, and dramatic play INDICATORS POI',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'DR, O Curriculum Teaching-Le arning Activities- Observation Notes/Class room Activities '
                         'Samples of childrens work Presence of te acher- made/prepar ed materials t hat support '
                         'curriculum activities uding those children with special needs. GATHER ED',
             'guideline': 'C. The curriculum develops CONCEPTS and VALUES in Health and Safety, Literacy, Numeracy, '
                          'Science, Social Studies, Technology,',
             'id': 'curriculum_instruction_assessment_10',
             'label': 'Activities are provided to help young children appreciate their own culture and heritage. '
                      'determine the childs developmental progress when planning for INDICATORS POI',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'DR, O Childs Ass Records Curriculum Guides/ Teaching-Le arning Activities Observation Notes/ '
                         'Classroom A ctivities GATHERED',
             'guideline': 'D. Instruction is ADJUSTABLE based on the regular assessment of the young children. Several '
                          'ASSESSMENT METHODS are used to help',
             'id': 'curriculum_instruction_assessment_11',
             'label': 'Authentic forms of assessment are conducted among all children to identify childrens progress '
                      'and development needs. INDICATORS',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR, O Child Recor ds Narrative Obser vation Notes/ Class room Activities',
             'guideline': 'D. Instruction is ADJUSTABLE based on the regular assessment of the young children. Several '
                          'ASSESSMENT METHODS are used to help',
             'id': 'curriculum_instruction_assessment_12',
             'label': 'Children are not assessed through paper and pencil tests. Assessment methods used include '
                      'teacher observations, information shared by childrens families, anecdotal records, checklists, '
                      'rating scales, portfolios that include samples of childrens work, photographs, etc.',
             'method': 'DR/O/I',
             'number': 12,
             'points': 1},
            {'evidence': 'O Child Recor ds Curri culum Guides/ Teach ing-Learning Activ ities Obser vation Notes/ '
                         'Class room Activities GATHERED',
             'guideline': 'D. Instruction is ADJUSTABLE based on the regular assessment of the young children. Several '
                          'ASSESSMENT METHODS are used to help',
             'id': 'curriculum_instruction_assessment_13',
             'label': 'Data from assessments are also used to adapt curriculum, activities, practices, routines and '
                      'settings to meet the needs of young children. INDICATORS',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'DR, O D P rogram/Routine C urriculum Guides/ T eaching-Learning A ctivities O bservation '
                         'Notes/ C lassroom',
             'guideline': 'E. There is a STRUCTURE that supports the instruction of young children.',
             'id': 'curriculum_instruction_assessment_14',
             'label': 'The daily schedule provides a balance in the conduct of the following: indoor and outdoor '
                      'activities for small and large muscle development and coordination; quiet and active '
                      'activities; individual, small group, or large group activities; and child initiated/staff '
                      'directed activities.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'O, DR O C lassroom Activities D aily Classroom P rogram/Routine',
             'guideline': 'E. There is a STRUCTURE that supports the instruction of young children.',
             'id': 'curriculum_instruction_assessment_15',
             'label': 'Time or a work period is allotted to every child for free play to enhance creativity and '
                      'independence, and to activities that build young childrens interests and sustain childrens '
                      'initiatives.',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'O O P resence of sensory m aterials',
             'guideline': 'E. There is a STRUCTURE that supports the instruction of young children.',
             'id': 'curriculum_instruction_assessment_16',
             'label': 'Materials such as open -ended and sensory materials (e.g. blocks, sand, water, play dough, '
                      'manipulatives and art materials) are provided so that young children can select their own '
                      'activities on a free-time basis, comprising of at least one activity period for half -day '
                      'programs for young children to experiment with.',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1},
            {'evidence': 'O, DR O C lassroom Activities C urriculum Guides/ T eaching-Learning A ctivities GATHERED',
             'guideline': 'E. There is a STRUCTURE that supports the instruction of young children.',
             'id': 'curriculum_instruction_assessment_17',
             'label': 'Teacher-directed, large groups and/or sedentary activities are limited. INDICATORS',
             'method': 'DR/O/I',
             'number': 17,
             'points': 1},
            {'evidence': 'O Obser Class room Activities',
             'guideline': 'F. Daily ROUTINES are flexible but predictable.',
             'id': 'curriculum_instruction_assessment_18',
             'label': 'Routines are tailored to fit young childrens needs and interests as much as possible.',
             'method': 'DR/O/I',
             'number': 18,
             'points': 1},
            {'evidence': 'O Obser Class room Activities',
             'guideline': 'F. Daily ROUTINES are flexible but predictable.',
             'id': 'curriculum_instruction_assessment_19',
             'label': 'The staff adjust to changes or unexpected situations in a relaxed manner.',
             'method': 'DR/O/I',
             'number': 19,
             'points': 1},
            {'evidence': 'O Obser Class room Activities',
             'guideline': 'F. Daily ROUTINES are flexible but predictable.',
             'id': 'curriculum_instruction_assessment_20',
             'label': 'Young children are not rushed to finish or stop when deeply engaged in an activity.',
             'method': 'DR/O/I',
             'number': 20,
             'points': 1},
            {'evidence': 'O, DR Obser Class room Activities Curri culum Guides/ Teach ing- Learning Activ ities GAT '
                         'HERED',
             'guideline': 'F. Daily ROUTINES are flexible but predictable.',
             'id': 'curriculum_instruction_assessment_21',
             'label': 'Cues or creative transition techniques, such as developmentally appropriate songs, familiar '
                      'phrases or visual cues are regularly used to support smooth transitions between activities. '
                      'INDICATORS P',
             'method': 'DR/O/I',
             'number': 21,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides',
             'guideline': 'G. There are QUIET OR REST ACTIVITIES as extended rest period requirements.',
             'id': 'curriculum_instruction_assessment_22',
             'label': 'Young children are allowed the amount of quiet activity, rest or sleep appropriate to '
                      'individual needs, and appropriate places/ activities and supervision are provided to young '
                      'children who are not sleeping.',
             'method': 'DR/O/I',
             'number': 22,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides GAT HERED',
             'guideline': 'G. There are QUIET OR REST ACTIVITIES as extended rest period requirements.',
             'id': 'curriculum_instruction_assessment_23',
             'label': 'Quiet activities include, but are not limited to, puzzle play, books, listening to music, '
                      'relaxation, sleep or playing with manipulatives. INDICATORS P',
             'method': 'DR/O/I',
             'number': 23,
             'points': 1},
            {'evidence': 'O, DR Observat Classroo m Activities Curricul um Guides/ Teaching - Learning Activiti es '
                         'GATHE RED',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_24',
             'label': 'Routine self-help tasks, such as toileting, eating and dressing are handled based on individual '
                      'needs and in a positive, relaxed and reassuring environment. INDICATORS PO',
             'method': 'DR/O/I',
             'number': 24,
             'points': 1},
            {'evidence': 'O, DR Observati Curriculu m Guides/ Teaching- Learning Activitie s VISON at all times and to '
                         'provide and cognitive/intellectual devel opment. GATHE RED',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_25',
             'label': 'Self-help skills are incorporated into the program as opportunities for developing conversation '
                      'and playful interaction to bring about childrens learning. I. The program has the NUMBER OF '
                      'STAFF necessary to ensure ADE INDIVIDUAL INSTRUCTION to young children to promote physical, '
                      'INDICATORS PO',
             'method': 'DR/O/I',
             'number': 25,
             'points': 1},
            {'evidence': 'O, DR Observati of childr en present CDC/LC Po licies Enrollmen t Document',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_26',
             'label': 'The program maintains at least a minimum teacher-child ratio of 1:10, and if it reaches the '
                      'maximum of 1:25, there is a teacher - aide/assistant/trained parent or trained adult volunteer.',
             'method': 'DR/O/I',
             'number': 26,
             'points': 1},
            {'evidence': 'O, DR Observati No. of st aff & children present CDC/LC Po licies Enrollmen t Document GA '
                         'THERED',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_27',
             'label': 'For programs for toddlers that involve training parents to care and provide early '
                      'learning, a minimum of teacher -parent ratio of 1:5 is maintained with a teacher aide/ '
                      'assistant, if applicable. INDICATORS P',
             'method': 'DR/O/I',
             'number': 27,
             'points': 1},
            {'evidence': 'DR, I CDC/LC names o f two adults Certifi cates of Training Intervi ew Notes on roles o f '
                         'the adults',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_28',
             'label': 'There is a minimum of two adults trained in health care, nutrition and emergency procedures.',
             'method': 'DR/O/I',
             'number': 28,
             'points': 1},
            {'evidence': 'DR Current staff a ssignment',
             'guideline': 'H. There are opportunities for young children to practice SELF -HELP skills.',
             'id': 'curriculum_instruction_assessment_29',
             'label': 'There is a written staff schedule that is kept current.',
             'method': 'DR/O/I',
             'number': 29,
             'points': 1}],
  'max_score': 29,
  'minimum_score': 22,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'V. Curriculum, Instruction and Assessment'},
 {'description': 'Family involvement, parent partnership, outreach, and community linkages.',
  'id': 'family_involvement_community',
  'items': [{'evidence': 'DR CDC/LC Reco Orientation to Parents on Programs and Services Of fered',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_1',
             'label': 'The Center provides a clear orientation on child protection programs and services to '
                      'parents/families/guardians and on health, nutrition, early learning and social services.',
             'method': 'DR/O/I',
             'number': 1,
             'points': 1},
            {'evidence': 'DR Copies of C Handbook/Br ochure/ Fold Out/Ha ndouts GATHERED',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_2',
             'label': 'Written information about the delivery of programs and services, and policies of the Center are '
                      'provided to parents upon the admission of their young children to the Center. There should be '
                      'signed agreements with parents in relation to the rules and regulations of the Center. '
                      'INDICATORS 3. Opportunities are given to parents/authorized guardians/caregivers to participate '
                      'in the following activities to enhance their knowledge and skills for the development of the '
                      'full potential of their young children:',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'DR CDC/ Pare nts/Authorized Guar dians/Care-givers who participated in acti vities',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_3',
             'label': 'Parent education or Responsible Parenthood (e.g. Parent Effectiveness Services Seminar (PESS), '
                      'Empowerment Reaffirmation of Paternal Abilities Training (ERPAT), reinforcing/promoting '
                      'positive behavior, alternative discipline); Family Support Program; Curriculum review and '
                      'development of instructional materials; Childrens assessment of their growth and development; '
                      'and Trainings on First Aid, Disaster Preparedness, PABASA sa Nutrisyon, and Nutrition in '
                      'Emergencies. 4. Family members and guardians are given written instructions to attend the '
                      'following:',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'DR CDC/ comm unications *re orga nization of PTA/PTCA GA THERED',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_4',
             'label': 'Organization of Child Development Center Parents Organization/Committee, and INDICATORS P',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'DR CDC/LC communi cations *re CIP dev elopment, impleme ntation, evaluat ion',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_5',
             'label': 'CDTs/CDWs, Parents and Barangay officials conduct regular meetings to develop the Centers '
                      'Improvement Plan (CIP) and its implementation, and to evaluate the implemented activities. 5. '
                      'The Centers program is sustainable through the parents support:',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR CDC/LC activit ies participated by parents /Photographs',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_6',
             'label': 'Ensure continuity of the significant activities being done in the Center (e.g. hand washing, '
                      'tooth brushing, etc.).',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'I CDC/LC Volunte ers GA THERED',
             'guideline': 'A. The Center implements SUPPORTIVE PARTNERSHIP with parents as the PRIMARY EDUCATORS of '
                          'their young children. Staff and pare nts',
             'id': 'family_involvement_community_7',
             'label': 'Promote parents/authorized guardians/ caregivers to become active volunteers of the Center and '
                      'the community. INDICATORS P',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'DR CDC/LC on Fiel dtrips to the Communi ty (e.g. Lakbay Bulilit) Teachin g Learning- Activit '
                         'ies about the Communi ty Photogr aphs of the communi ty',
             'guideline': 'B. The Center conducts OUTREACH PROGRAM to harness COMMUNITY INVOLVEMENT and LINKAGES.',
             'id': 'family_involvement_community_8',
             'label': 'The Center mobilizes the community during outreach programs and other Center activities.',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'DR CDC/LC on Fiel dtrips to the Communi ty (e.g. Lakbay Bulilit) Teachin g/Learning Activit '
                         'ies about the Com munity Photogr aphs of the communi ty',
             'guideline': 'B. The Center conducts OUTREACH PROGRAM to harness COMMUNITY INVOLVEMENT and LINKAGES.',
             'id': 'family_involvement_community_9',
             'label': 'Curricular activities include educational community trips to improve young childrens exposure '
                      'to community facilities and resources for them to be aware of ones culture, and environmental '
                      'care, protection and conservation.',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'DR CDC/LC Stakeho lders',
             'guideline': 'B. The Center conducts OUTREACH PROGRAM to harness COMMUNITY INVOLVEMENT and LINKAGES.',
             'id': 'family_involvement_community_10',
             'label': 'The Center links/networks with partners/ stakeholders to contribute, develop and sustain '
                      'programs that will, among others, promote the safety and protection of young children from '
                      'abuse and neglect.',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1}],
  'max_score': 10,
  'minimum_score': 7,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'VI. Family Involvement and Community Linkages'},
 {'description': 'Leadership, program management, records, supervision, staffing, and support systems.',
  'id': 'leadership_program_management',
  'items': [{'evidence': 'DR, I Baranga Council Resolution Deed of Donation Buildin g Permit Intervi ew Notes with the '
                         'loc al officials / DR SEC Reg Mayors Business Permit GATH ERED',
             'guideline': 'A. The CDC/LC has evidence of its AUTHORITY TO OPERATE.',
             'id': 'leadership_program_management_1',
             'label': 'The Public CDC provides evidence of its authority to operate programs under the Local '
                      'Government Unit, as provided in R.A. 10410 known as the Early Years Act of 2013. / The Private '
                      'CDC/LC maintains documents that fully and completely identify its ownership. A corporation, '
                      'partnerships or association identifies its officers and maintains a file that includes, where '
                      'applicable, the charter/ partnership agreement/constitution/articles of organization and '
                      'by-laws, and is registered in the Securities and Exchange Commission and has a business permit '
                      'from the Local Government Unit. for the Private CDC/LC. INDICATORS PO',
             'method': 'DR, I',
             'number': 1,
             'points': 1},
            {'evidence': 'DR, I Minutes o Activity report including attendance & photogr aphs on Plan Developme nt '
                         'Three-Yea r Plan & Annual Pl an Interview s Notes with local off icials, DCT/W, parents a s '
                         'respondents',
             'guideline': 'B. The Public CDC has a written THREE-YEAR IMPROVEMENT PLAN and AN ANNUAL WORK AND '
                          'FINANCIAL PLAN, or its EQUIVALENT',
             'id': 'leadership_program_management_2',
             'label': 'The Plan is cooperatively prepared by the CDC Committee composed of the Municipal Mayor as the '
                      'Chairperson, the City/Municipal Social Development Officer, and the Principal of the nearby '
                      'elementary school as Vice- Chairpersons; with the Barangay Captain, the Barangay Nutrition '
                      'Scholar, the Barangay Health Worker, and the Child Development Teacher/Worker as Members. In '
                      'the planning, parent representatives are invited. For the Public NGA/GOCC and Private Learning '
                      'Center, the Director/Principal and the Members of the Board and parent representatives are '
                      'tasked to prepare this Plan.',
             'method': 'DR/O/I',
             'number': 2,
             'points': 1},
            {'evidence': 'DR Three-Yea Annual Pl an',
             'guideline': 'B. The Public CDC has a written THREE-YEAR IMPROVEMENT PLAN and AN ANNUAL WORK AND '
                          'FINANCIAL PLAN, or its EQUIVALENT',
             'id': 'leadership_program_management_3',
             'label': 'The Plan contains the Vision, Mission, Goals, Objectives, Activities, Budget Allocation, Target '
                      'Date, Persons Involved and Output Indicators.',
             'method': 'DR/O/I',
             'number': 3,
             'points': 1},
            {'evidence': 'DR, I Report Ca Interview Notes with the C/MSW DOs and parents a s respondents VATE CDC/LC '
                         'is ADMINISTERED, MANA GED, GATHERED Development Plan/ Action Plan on Cen ters '
                         'Maintenance/Curric ulum and Programs Activity Reports of C/ MSWDO Accomplishment Rep ort of '
                         'the C/MSWDO Interview Notes with CDT/ CDW Observation and Fe ed backing Reports of C/ MSWDO '
                         'Accomplishment Rep orts of the C/MSWDO GATHERED',
             'guideline': 'B. The Public CDC has a written THREE-YEAR IMPROVEMENT PLAN and AN ANNUAL WORK AND '
                          'FINANCIAL PLAN, or its EQUIVALENT',
             'id': 'leadership_program_management_4',
             'label': 'A Center Report Card/Annual Accomplishment Report is prepared by the Child Development '
                      'Teacher/Worker in consultation with the C/MSWDO Focal Person for ECCD Program for the public '
                      'CDCs and with the Administrator/ Director/Prinicipal for private CDC/LC, and presented to the '
                      'Committee and parents at the end of the school year. This Report is the basis for the '
                      'succeeding school years Annual Work and Financial Plan. CITY/ MUNICIPAL SOCIAL DEVELOPMENT '
                      'WORKER or FOCAL PERSON IN EC and SUPERVISED by its ADMINISTRATOR/DIRECTOR/PRINCIPAL. INDICATORS '
                      'POINTS 5. The supervisory responsibilities may include but not limited to the following: '
                      'Oversee the development and 1 maintenance of the Center and its early childhood curriculum and '
                      'programs; Observe classroom activities and 1 provide feedback to CDTs/CDWs and other staff; '
                      'INDICATORS',
             'method': 'DR/O/I',
             'number': 4,
             'points': 1},
            {'evidence': 'DR, I Devel Plans on Family Support Progr am/Activities Activ ity/Accomplishment Repor ts '
                         'Inter view Notes with local govt. officials, CDT/ CDW a nd parents as respo ndents',
             'guideline': 'C. The program of the CDC is ADMINISTERED and MANAGED by the CDC LOCAL '
                          'COMMITTEE/TEAM/OFFICE AND is SUPERVISED by the',
             'id': 'leadership_program_management_5',
             'label': 'Provide family support and education relevant to early learning;',
             'method': 'DR/O/I',
             'number': 5,
             'points': 1},
            {'evidence': 'DR Polic Circu lars Issued',
             'guideline': 'C. The program of the CDC is ADMINISTERED and MANAGED by the CDC LOCAL '
                          'COMMITTEE/TEAM/OFFICE AND is SUPERVISED by the',
             'id': 'leadership_program_management_6',
             'label': 'Plan and issue policies needed in the implementation of the curriculum and program;',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'DR, I Profe Devel opment Plan/Action Plans Activity Reports on staff devel opment activities '
                         'Accom plishment Report of the c oncerned staff Intervie w Notes with the CDT/C DW and '
                         'parents as respo ndents G ATHERED',
             'guideline': 'C. The program of the CDC is ADMINISTERED and MANAGED by the CDC LOCAL '
                          'COMMITTEE/TEAM/OFFICE AND is SUPERVISED by the',
             'id': 'leadership_program_management_7',
             'label': 'Plan and implement staff development programs; and INDICATORS',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'DR, I Actio Imple mentation of Stand ards Orien tation/Training on Stand ards Activ ity '
                         'Reports Inter view Notes with local government offic ials, CDT/ CDW and paren ts as '
                         'respondents',
             'guideline': 'C. The program of the CDC is ADMINISTERED and MANAGED by the CDC LOCAL '
                          'COMMITTEE/TEAM/OFFICE AND is SUPERVISED by the',
             'id': 'leadership_program_management_8',
             'label': 'Support the implementation of standards for early childhood programs.',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'DR, I Cente Super visory Reports Inter view Notes with CDT/C DW/Teacher Aide and parents as '
                         'respo ndents GATHER ED',
             'guideline': 'C. The program of the CDC is ADMINISTERED and MANAGED by the CDC LOCAL '
                          'COMMITTEE/TEAM/OFFICE AND is SUPERVISED by the',
             'id': 'leadership_program_management_9',
             'label': 'Records of the results of supervisory visits are made available to the Child Development '
                      'Teacher/Worker and to the Teacher Aide, and shall serve as the bases for the performance '
                      'evaluation of these staff. CONFIDENTIAL for each child. INDICATORS POI',
             'method': 'DR/O/I',
             'number': 6,
             'points': 1},
            {'evidence': 'DR, I Center Poli Record of p arents consent for the release of a child s records Interview '
                         'N otes with parents as respondents',
             'guideline': 'D. The administration, through the Child Development Teacher/Worker, has CHILD RECORDS that '
                          'are MAINTAINED and KEPT',
             'id': 'leadership_program_management_10',
             'label': 'Information in the childs records is not released to individuals without the written consent of '
                      'parents.',
             'method': 'DR/O/I',
             'number': 7,
             'points': 1},
            {'evidence': 'I Interview n parents as respondents',
             'guideline': 'D. The administration, through the Child Development Teacher/Worker, has CHILD RECORDS that '
                          'are MAINTAINED and KEPT',
             'id': 'leadership_program_management_11',
             'label': 'The childs parent(s), upon request, have access to the childs record.',
             'method': 'DR/O/I',
             'number': 8,
             'points': 1},
            {'evidence': 'DR, I Center Poli Interview N otes with parents as respondents GAT HERED',
             'guideline': 'D. The administration, through the Child Development Teacher/Worker, has CHILD RECORDS that '
                          'are MAINTAINED and KEPT',
             'id': 'leadership_program_management_12',
             'label': 'A childs parent(s) has the right to add information, comments, data or any relevant material to '
                      'the childs record, or has the right to request the deletion or amendment of any information '
                      'contained in the childs record, if supported by a legal document. INDICATORS P',
             'method': 'DR/O/I',
             'number': 9,
             'points': 1},
            {'evidence': 'DR, I Centers Centers Fil e of Medical Check-Up /Services given to children Intervie w Notes '
                         'with parents, CDT/CDW as responde nts',
             'guideline': 'E. The program has procedures for REFERRAL.',
             'id': 'leadership_program_management_13',
             'label': 'The program has procedures for referring parents to appropriate services for the child and '
                      'his/her family, including but not limited to dental/medical check-up, vision and/or hearing '
                      'screening, kindergarten screening, social, mental health and educational and medical services, '
                      'should the staff feel that assessment for such additional services would benefit the child.',
             'method': 'DR/O/I',
             'number': 10,
             'points': 1},
            {'evidence': 'DR, I Centers Fil up of re ferrals Intervie w with parents as respo ndents GAT HERED',
             'guideline': 'E. The program has procedures for REFERRAL.',
             'id': 'leadership_program_management_14',
             'label': 'The program provides follow-up to the referral with parental permission, and contacts the '
                      'agency or service provider who evaluated the child for consultation and assistance in meeting '
                      'the childs needs. the Private CDC/LC. INDICATORS P 12. The CDT/CDW/Teacher Aide in a public CDC '
                      'is hired following the process below:',
             'method': 'DR/O/I',
             'number': 11,
             'points': 1},
            {'evidence': 'DR, I Minutes of t Copy of announcements posted Applicat ion papers on file File on Eva '
                         'luation of Applican ts Intervie w Notes with local go vt. officials, CDT/ CDW/staf f hired '
                         'as responde nts GA THERED List o f Qualified Applic ants Letter of appointment',
             'guideline': 'F. The program follows a process on the recruitment and hiring of the Child Development '
                          'Teacher/Worker and Teacher Aide or its equivalent for',
             'id': 'leadership_program_management_15',
             'label': 'Initial Meeting between the Local Executive/Mayor and the C/MSWDO/ECCD Focal Person on the '
                      'recruitment and hiring of the CDT/CDW/Teacher Aide, The C/MSWDO/ECCD Focal Person disseminates '
                      'the information of accepting applicants for the vacant position, Applicants submit the required '
                      'documents (Personal Data Sheet, College Diploma, Transcript of Records, Results of Physical '
                      'Examination and Psychological Test) to the MSWDO/ECCD Coordinator, C/MSWDO/ECCD Focal Person '
                      'evaluates the submitted documents and determines which applicants are qualified or not, '
                      'INDICATORS The C/MSWDO/ECCD Focal Person submits the list of qualified applicants to the Local '
                      'Executive/Mayor, and The Local Executive/Mayor appoints the qualified applicant. For the '
                      'Private CDC/LC and public CDC established by NGOs/NGAs/GOCCs, the',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'DR, I Copy of t announ cement Applic ation papers on file Interview with the HR, applic ants '
                         'and hired staff CDC/LC Board/Committee/office that hires them. GATHE RED',
             'guideline': 'F. The program follows a process on the recruitment and hiring of the Child Development '
                          'Teacher/Worker and Teacher Aide or its equivalent for',
             'id': 'leadership_program_management_16',
             'label': 'recruitment and hiring are done in accordance with the rules and procedures approved by its '
                      'Board/Committee. CDCs/TEACHER AIDES and its ADMINISTRATIVE STAFF shall be paid o INDICATORS PO',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1},
            {'evidence': 'DR, I 201 file Contract Pay slip Interview with the Budget/HR Officer',
             'guideline': 'G. The MONTHLY SALARY of the PUBLIC CDT/CDW/TEACHER AIDE shall be shouldered by the '
                          'LGU/NGA/GOCC, while PRIVATE',
             'id': 'leadership_program_management_17',
             'label': 'The salary of the public CDT/CDW will be based on the Salary Grade of Teacher I (SG II) of the '
                      'Department of Education, but the amount will depend on the monthly salary schedule of the local '
                      'government personnel per DBM Local Budget Circular no. 99 dated May 25, 2012.',
             'method': 'DR/O/I',
             'number': 13,
             'points': 1},
            {'evidence': 'DR, I Board Reso Contract Pay slip Interview with the Budget/HR Officer',
             'guideline': 'G. The MONTHLY SALARY of the PUBLIC CDT/CDW/TEACHER AIDE shall be shouldered by the '
                          'LGU/NGA/GOCC, while PRIVATE',
             'id': 'leadership_program_management_18',
             'label': 'A Teacher Aide in a public CDC shall be paid on an honorarium basis as approved by a '
                      'Sangguniang Bayan Resolution of the Local Government Unit or in a Resolution by the NGA or '
                      'GOCC.',
             'method': 'DR/O/I',
             'number': 14,
             'points': 1},
            {'evidence': 'DR, I Board Reso 201 file Contract Pay slip Interview with the HR/ Budget Off icer, staff '
                         'GATHERED',
             'guideline': 'G. The MONTHLY SALARY of the PUBLIC CDT/CDW/TEACHER AIDE shall be shouldered by the '
                          'LGU/NGA/GOCC, while PRIVATE',
             'id': 'leadership_program_management_19',
             'label': 'The salary of a private CDCs teacher aides and administrative staff shall be paid by the CDC/LC '
                      'that hired them, in accordance with the approved resolution of the Board/ Committee. INDICATORS',
             'method': 'DR/O/I',
             'number': 19,
             'points': 1},
            {'evidence': 'DR, I 201 f stora ge Inter view Notes with the H R and staff as respo ndents',
             'guideline': 'H. The program MAINTAINS A CONFIDENTIAL PERSONNEL RECORD for each staff member.',
             'id': 'leadership_program_management_20',
             'label': 'The confidential personnel record includes, but is not limited to the following: employees '
                      'resume, documentation that the employee has qualifications required for the position, reference '
                      'verification, medical and dental records, documentation of staff in -service training, annual '
                      'evaluation, attendance records, and verification that the employee has received and understood '
                      'program policies.',
             'method': 'DR/O/I',
             'number': 15,
             'points': 1},
            {'evidence': 'DR, I 201 fi Interv iew Notes with the HR and staff as respon dents',
             'guideline': 'H. The program MAINTAINS A CONFIDENTIAL PERSONNEL RECORD for each staff member.',
             'id': 'leadership_program_management_21',
             'label': 'The records of personnel files are updated and well-maintained, and the management upholds the '
                      'confidentiality of these files.',
             'method': 'DR/O/I',
             'number': 16,
             'points': 1}],
  'max_score': 21,
  'minimum_score': 16,
  'part': 'Assessment Tool for the Granting of Recognition',
  'title': 'VII. Leadership, Program Management and Support'}],
    'summary_areas': [
        {'area': 'I. Health, Nutrition, and Safety', 'maximum_points': 66, 'minimum_points': 49},
        {'area': 'II. Physical Environment and Safety', 'maximum_points': 34, 'minimum_points': 25},
        {'area': 'III. Interactions and Relationships Between Staff and Children, Among Children and Other Adults', 'maximum_points': 15, 'minimum_points': 11},
        {'area': 'IV. Staff Qualifications, Staff Development and Continuing Education', 'maximum_points': 35, 'minimum_points': 26},
        {'area': 'V. Curriculum, Instruction and Assessment', 'maximum_points': 29, 'minimum_points': 22},
        {'area': 'VI. Family Involvement and Community Linkages', 'maximum_points': 10, 'minimum_points': 7},
        {'area': 'VII. Leadership, Program Management and Support', 'maximum_points': 21, 'minimum_points': 16},
    ],
    'closing_fields': [
        {'key': 'observation_sheet', 'label': 'Observation Sheet: Date / Indicator No. / Area of Focus / Observation Notes', 'type': 'textarea'},
        {'key': 'interview_sheet', 'label': 'Interview Sheet: Date / Indicator No. / Area of Focus / Person(s) Interviewed/Respondents / Responses/Interview Notes', 'type': 'textarea'},
        {'key': 'document_review_sheet', 'label': 'Document Review Sheet: Date / Indicator No. / Area of Focus / Documents Reviewed / Findings', 'type': 'textarea'},
        {'key': 'recommended_action', 'label': 'Recommendation: Conferment of Recognition or Deferment of Recognition', 'type': 'textarea'},
        {'key': 'evaluator_1', 'label': 'Prepared and submitted by Evaluator 1: Name / Signature / Date', 'type': 'text'},
        {'key': 'evaluator_2', 'label': 'Prepared and submitted by Evaluator 2: Name / Signature / Date', 'type': 'text'},
        {'key': 'evaluator_3', 'label': 'Prepared and submitted by Evaluator 3: Name / Signature / Date', 'type': 'text'},
    ],
}


def get_accreditation_checklist():
    return ACCREDITATION_CHECKLIST

