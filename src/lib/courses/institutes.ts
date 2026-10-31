/**
 * Institute logos, served from /public/institutes as 128px PNGs. They came
 * from each institute's Wikipedia article (thumbnails, so never a raw SVG
 * served from our origin). NPTEL spells institutes inconsistently ("IIT(BHU)
 * Varanasi", "IIT (BHU) Varanasi", "IIT Bhubaneshwar"), so names are matched
 * on a normalised prefix. An institute without a logo gets its monogram.
 */

const PREFIXES: [string, string][] = [
  ["iitkharagpur", "iit-kharagpur"],
  ["iitmadras", "iit-madras"],
  ["iitkanpur", "iit-kanpur"],
  ["iitroorkee", "iit-roorkee"],
  ["iitguwahati", "iit-guwahati"],
  ["iitbombay", "iit-bombay"],
  ["iitdelhi", "iit-delhi"],
  ["iithyderabad", "iit-hyderabad"],
  ["iitism", "iit-ism"],
  ["iitindore", "iit-indore"],
  ["iitropar", "iit-ropar"],
  ["iitbhubane", "iit-bhubaneswar"],
  // After Bhubaneswar, which also starts with "iitbhu".
  ["iitbhu", "iit-bhu"],
  ["iittirupati", "iit-tirupati"],
  ["iitgoa", "iit-goa"],
  ["iitjodhpur", "iit-jodhpur"],
  ["iitgandhinagar", "iit-gandhinagar"],
  ["iitjammu", "iit-jammu"],
  ["iitbhilai", "iit-bhilai"],
  ["iisc", "iisc"],
  ["iiserbhopal", "iiser-bhopal"],
  ["iiserpune", "iiser-pune"],
  ["iisermohali", "iiser-mohali"],
  ["iiserkolkata", "iiser-kolkata"],
  ["iiitdelhi", "iiit-delhi"],
  ["iiitbangalore", "iiit-bangalore"],
  ["iiitb", "iiit-bangalore"],
  ["iiithyderabad", "iiit-hyderabad"],
  ["nalsar", "nalsar"],
  ["chennaimathematical", "cmi"],
  ["visvabharati", "visva-bharati"],
  ["imsc", "imsc"],
  ["universityofhyderabad", "uoh"],
  ["instituteofchemicaltechnology", "ict-mumbai"],
  ["homibhabha", "hbni"],
  ["nationallawschool", "nlsiu"],
  ["indianinstituteofspace", "iist"],
  ["isibangalore", "isi"],
  ["indianstatistical", "isi"],
  ["universityofallahabad", "allahabad"],
  ["azimpremji", "apu"],
  ["tatainstituteofsocial", "tiss"],
  ["afmc", "afmc"],
  ["theinstituteofcostaccountants", "icmai"],
  ["schoolofplanningandarchitecturevijayawada", "spa-vijayawada"],
  ["kufos", "kufos"],
  ["icmrnationalinstituteofepidemiology", "nie-icmr"],
  ["delhitechnological", "dtu"],
];

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/** The path to an institute's logo, or null when there isn't one. */
export function instituteLogo(institute: string): string | null {
  const n = normalise(institute);
  const hit = PREFIXES.find(([prefix]) => n.startsWith(prefix));
  return hit ? `/institutes/${hit[1]}.png` : null;
}

/** Every logo file the table points at, for the test that keeps them in step. */
export const LOGO_FILES = [...new Set(PREFIXES.map(([, file]) => file))];
