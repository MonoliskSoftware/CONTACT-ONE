// // Task Force "Liberty" - AOF Breakthrough Force
// const TaskForceLiberty = {
//     name: "Task Force Liberty",
//     description: "Elite combined arms force specialized in rapid movement and urban warfare, tasked with capturing Washington D.C.",
//     // Main Ground Combat Element
//     subordinates: [
//         {
//             name: "1st Strike Brigade",
//             classProfile: USProfiles.MechanizedInfantry,
//             members: [[BrigadeStaffLoadout, 10]], // Lean command structure for quick decisions
//             subordinates: [
//                 // Main Assault Force
//                 {
//                     name: "1st Combined Arms Battalion",
//                     classProfile: USProfiles.MechanizedInfantry,
//                     members: [[BattalionStaffLoadout, 8]],
//                     subordinates: [
//                         // 2 Mechanized Companies (IFVs + Infantry)
//                         {
//                             name: "Alpha Company",
//                             classProfile: USProfiles.MechanizedInfantry,
//                             members: [[CompanyStaffLoadout, 5]],
//                             // Urban warfare capable
//                         },
//                         {
//                             name: "Bravo Company",
//                             classProfile: USProfiles.MechanizedInfantry,
//                             members: [[CompanyStaffLoadout, 5]],
//                             // Urban warfare capable
//                         },
//                         // Armor Company
//                         {
//                             name: "Charlie Company",
//                             classProfile: USProfiles.Armor,
//                             members: [[CompanyStaffLoadout, 5]],
//                             // Heavy punch for breakthrough operations
//                         }
//                     ]
//                 },

//                 // Fast Attack Battalion
//                 {
//                     name: "2nd Light Battalion",
//                     classProfile: USProfiles.MotorizedInfantry,
//                     members: [[BattalionStaffLoadout, 8]],
//                     subordinates: [
//                         // 3 Motorized Infantry Companies
//                         // Highly mobile, can secure key points quickly
//                     ]
//                 },

//                 // Direct Support
//                 {
//                     name: "1st Combat Support Battalion",
//                     members: [[BattalionStaffLoadout, 6]],
//                     subordinates: [
//                         {
//                             name: "Alpha Battery",
//                             classProfile: USProfiles.FieldArtillery,
//                             // Mobile artillery for fire support
//                         },
//                         {
//                             name: "Bravo Battery",
//                             classProfile: USProfiles.Experimental.AirDefense,
//                             // Critical for defending against AGF air attacks
//                         },
//                         {
//                             name: "Charlie Company",
//                             classProfile: USProfiles.Engineer,
//                             // Urban combat engineering & fortification
//                         }
//                     ]
//                 }
//             ]
//         },

//         // Air Support Element
//         {
//             name: "1st Air Support Group",
//             subordinates: [
//                 {
//                     name: "1st Attack Squadron",
//                     classProfile: USProfiles.Experimental.AttackAviation,
//                     // Attack helicopters for close air support
//                 },
//                 {
//                     name: "2nd Air Defense Squadron",
//                     classProfile: USProfiles.Experimental.AirSuperiority,
//                     // Maintaining local air superiority
//                 }
//             ]
//         },

//         // Special Operations Element
//         {
//             name: "1st Special Operations Group",
//             subordinates: [
//                 {
//                     name: "Alpha Company",
//                     classProfile: USProfiles.Experimental.SpecialForces,
//                     // Urban infiltration & key target seizure
//                 },
//                 {
//                     name: "Bravo Company",
//                     classProfile: USProfiles.Experimental.ReconnaissanceUnit,
//                     // Forward reconnaissance & intelligence gathering
//                 },
//                 {
//                     name: "Charlie Company",
//                     classProfile: USProfiles.Experimental.SignalsIntel,
//                     // Electronic warfare & communications disruption
//                 }
//             ]
//         },

//         // Combat Service Support
//         {
//             name: "1st Support Battalion",
//             classProfile: USProfiles.Sustainment,
//             subordinates: [
//                 {
//                     name: "Alpha Company",
//                     classProfile: USProfiles.Sustainment,
//                     // Mobile supply & maintenance
//                 },
//                 {
//                     name: "Bravo Company",
//                     classProfile: USProfiles.Experimental.MedicalSupport,
//                     // Combat medical support
//                 },
//                 {
//                     name: "Charlie Company",
//                     classProfile: USProfiles.Experimental.ChemicalDefense,
//                     // CBRN defense (crucial after nuclear strike)
//                 }
//             ]
//         }
//     ]
// };