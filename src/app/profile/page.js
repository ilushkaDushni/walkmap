import { User } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="flex flex-col items-center px-6 pt-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#353535]">
        <User className="h-10 w-10 text-white" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-[#353535]">Профиль</h1>
      <p className="text-sm text-gray-500">Раздел в разработке</p>
    </div>
  );
}
