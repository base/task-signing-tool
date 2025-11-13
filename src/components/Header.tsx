export function Header() {
  return (
    <div className="mb-12 text-center">
      <h1 className="relative m-0 bg-gradient-to-r from-amber-400 via-purple-500 via-pink-500 to-amber-400 bg-clip-text text-5xl font-black leading-tight text-transparent md:text-7xl">
        <span className="relative inline-block">
          <span className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-amber-400 blur-2xl opacity-50" />
          <span className="relative">Base Task Signer Tool</span>
        </span>
      </h1>
      <p className="mt-4 text-lg font-medium text-gray-600 md:text-xl">
        Premium signing experience for secure transactions
      </p>
    </div>
  );
}
