"use client";

interface DirectLinkProps {
  label?: string;
}

export default function AdsterraDirectLink({
  label = "Visiter notre partenaire",
}: DirectLinkProps) {
  const handleRedirect = () => {
    window.open(
      "https://tuxedoarbourannouncement.com/jdf6pfwxa?key=5f7e405b0101ac868a3136e76ee6d383",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="w-full flex justify-center my-4">
      <button
        onClick={handleRedirect}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors duration-200"
      >
        {label}
      </button>
    </div>
  );
}
