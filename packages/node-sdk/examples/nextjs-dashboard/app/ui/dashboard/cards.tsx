import {
  BanknotesIcon,
  ClockIcon,
  UserGroupIcon,
  InboxIcon,
} from "@heroicons/react/24/outline";
import { lusitana } from "@/app/ui/fonts";
import { fetchCardData } from "@/app/lib/data";
import { unstable_flag as flag } from "@vercel/flags/next";
import { auth } from "@/auth";
import { BucketClient } from "@bucketco/node-sdk";
import React from "react";



const iconMap = {
  collected: BanknotesIcon,
  customers: UserGroupIcon,
  pending: ClockIcon,
  invoices: InboxIcon,
};


// this essentially lives in `@bucketco/next-flags` or similar
const bucketClient = new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY ?? "",
  logger: console,
});

let initialized = false; // let me know if you have a better idea for this Dominik
const bucketAdapter = ({
  context,
}: {
  context: () => Promise<Record<string, any>>;
}) => {
  const getFeatures = React.cache(async () => {
    if (!initialized) {
      initialized = true;
      await bucketClient.initialize();
    }
    return bucketClient.getFeatures(await context());
  });

  return (key: string, defaultValue: boolean) => {
    return {
      key,
      origin: "https://app.bucket.co/flags"
      decide: async () => {
        const features = await getFeatures();
        return features[key] ? features[key].isEnabled : defaultValue;
      },
    };
  };
};

// this is what the user would write
const adaptor = bucketAdapter({
  context: async () => {
    const user = (await auth())?.user;
    const userId = user?.email;
    console.log("User", user);
    return userId
      ? {
          user: {
            id: userId,
          },
          company: {
            id: user?.email?.split("@")[1] ?? "",
          },
        }
      : {};
  },
});

export const showInvoices = flag(adaptor("show-invoices", false));
export const showPending = flag(adaptor("show-pending", false));

export default async function CardWrapper() {
  const {
    numberOfInvoices,
    numberOfCustomers,
    totalPaidInvoices,
    totalPendingInvoices,
  } = await fetchCardData();

  const invoices = await showInvoices();
  const pending = await showPending();

  return (
    <>
      <Card title="Collected" value={totalPaidInvoices} type="collected" />
      {pending && (
        <Card title="Pending" value={totalPendingInvoices} type="pending" />
      )}
      {invoices && (
        <Card title="Total Invoices" value={numberOfInvoices} type="invoices" />
      )}
      <Card
        title="Total Customers"
        value={numberOfCustomers}
        type="customers"
      />
    </>
  );
}

export function Card({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: "invoices" | "customers" | "pending" | "collected";
}) {
  const Icon = iconMap[type];

  return (
    <div className="rounded-xl bg-gray-50 p-2 shadow-sm">
      <div className="flex p-4">
        {Icon ? <Icon className="h-5 w-5 text-gray-700" /> : null}
        <h3 className="ml-2 text-sm font-medium">{title}</h3>
      </div>
      <p
        className={`${lusitana.className}
          truncate rounded-xl bg-white px-4 py-8 text-center text-2xl`}
      >
        {value}
      </p>
    </div>
  );
}
