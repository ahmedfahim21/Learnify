/**
 * The landing page's strip of institutes whose NPTEL lectures are here,
 * biggest contributors first. Logos from /public/institutes (see
 * lib/courses/institutes.ts). It scrolls on its own, pauses on hover, and
 * holds still for anyone who prefers reduced motion.
 */

const INSTITUTES: [file: string, name: string][] = [
  ["iit-kharagpur", "IIT Kharagpur"],
  ["iit-madras", "IIT Madras"],
  ["iit-kanpur", "IIT Kanpur"],
  ["iit-roorkee", "IIT Roorkee"],
  ["iit-guwahati", "IIT Guwahati"],
  ["iit-bombay", "IIT Bombay"],
  ["iisc", "IISc Bangalore"],
  ["iit-delhi", "IIT Delhi"],
  ["iit-hyderabad", "IIT Hyderabad"],
  ["iit-ism", "IIT (ISM) Dhanbad"],
  ["iiser-bhopal", "IISER Bhopal"],
  ["iiser-pune", "IISER Pune"],
  ["iit-bhu", "IIT (BHU) Varanasi"],
  ["iiit-delhi", "IIIT Delhi"],
  ["iiser-mohali", "IISER Mohali"],
  ["nalsar", "NALSAR University of Law"],
  ["cmi", "Chennai Mathematical Institute"],
  ["iit-indore", "IIT Indore"],
  ["visva-bharati", "Visva-Bharati"],
  ["imsc", "IMSc Chennai"],
  ["iiit-bangalore", "IIIT Bangalore"],
  ["iit-ropar", "IIT Ropar"],
  ["iit-bhubaneswar", "IIT Bhubaneswar"],
  ["uoh", "University of Hyderabad"],
  ["iiit-hyderabad", "IIIT Hyderabad"],
  ["ict-mumbai", "Institute of Chemical Technology"],
  ["iit-tirupati", "IIT Tirupati"],
  ["hbni", "Homi Bhabha National Institute"],
  ["iiser-kolkata", "IISER Kolkata"],
  ["nlsiu", "National Law School of India University"],
  ["iist", "IIST"],
  ["isi", "Indian Statistical Institute"],
  ["tiss", "Tata Institute of Social Sciences"],
  ["iit-goa", "IIT Goa"],
  ["iit-jodhpur", "IIT Jodhpur"],
  ["iit-gandhinagar", "IIT Gandhinagar"],
  ["iit-jammu", "IIT Jammu"],
  ["iit-bhilai", "IIT Bhilai"],
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-3 pr-3">
      {INSTITUTES.map(([file, name]) => (
        <li
          key={file}
          title={name}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-(--color-line) bg-white p-2 grayscale transition hover:grayscale-0 sm:h-20 sm:w-20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small static PNGs; next/image adds nothing here */}
          <img src={`/institutes/${file}.png`} alt={hidden ? "" : name} width={64} height={64} decoding="async" className="h-full w-full object-contain" />
        </li>
      ))}
    </ul>
  );
}

export function InstituteMarquee() {
  return (
    <section aria-labelledby="institutes-heading" className="space-y-5">
      <h2 id="institutes-heading" className="wrap text-center text-(--color-mist)">
        Lectures from the IITs, IISc and over 100 other institutes
      </h2>
      <div className="marquee group relative overflow-hidden">
        {/* Two copies side by side; the strip moves by exactly one copy and loops. */}
        <div className="marquee-track flex w-max group-hover:[animation-play-state:paused]">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}
