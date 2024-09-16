import Image from "next/image";
import { HuddleFeature } from "@/components/HuddleFeature";
import { Context } from "@/components/Context";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Context />
      <HuddleFeature />
    </main>
  );
}
