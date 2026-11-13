// src/app/commander-imprime/actions.ts
"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decideFulfilmentRoute } from "@/lib/fulfilment-routing";
import { generatePrintOrderNumber } from "@/lib/print-orders";
import {
  MAX_COPIES_PER_ORDER,
  STATE_REQUIRED_COUNTRIES,
  computePrintTotals,
  findAllowedCountry,
  getShippingTariffs,
} from "@/lib/print-shipping";
import { printPriceFloorXof } from "@/lib/print-pricing";

const MAX_UNPAID_ORDERS = 5;

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Crée une commande d'exemplaires imprimés, avec ses montants figés, puis ouvre son suivi. */
export async function createPrintOrderAction(formData: FormData): Promise<void> {
  const slug = readText(formData, "slug", 200);
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) {
    redirect("/catalogue");
  }

  const back = `/commander-imprime/${slug}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(back)}`);
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      sellerId: true,
      seller: { select: { status: true, userId: true } },
    },
  });

  if (
    !product ||
    product.kind !== "BOOK_EDITION" ||
    product.status !== "PUBLISHED" ||
    product.seller.status !== "ACTIVE"
  ) {
    redirect("/catalogue");
  }

  const edition = await prisma.printEdition.findUnique({ where: { productId: product.id } });

  if (
    !edition ||
    edition.status !== "ACTIVE" ||
    edition.retailPriceXof === null ||
    edition.printCostXof === null ||
    edition.retailPriceXof < printPriceFloorXof(edition.printCostXof)
  ) {
    redirect(`${back}?erreur=indisponible`);
  }

  const quantity = Number.parseInt(readText(formData, "quantity", 3), 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_COPIES_PER_ORDER) {
    redirect(`${back}?erreur=quantite`);
  }

  const country = findAllowedCountry(readText(formData, "country", 2));
  if (!country) {
    redirect(`${back}?erreur=pays`);
  }

  const name = readText(formData, "name", 120);
  const street1 = readText(formData, "street1", 150);
  const street2 = readText(formData, "street2", 150);
  const city = readText(formData, "city", 80);
  const state = readText(formData, "state", 40);
  const postcode = readText(formData, "postcode", 12);
  const phone = readText(formData, "phone", 30);

  const phoneDigits = phone.replace(/\D/g, "");

  if (
    name.length < 2 ||
    street1.length < 3 ||
    city.length < 2 ||
    postcode.length < 2 ||
    phoneDigits.length < 6 ||
    phoneDigits.length > 20
  ) {
    redirect(`${back}?erreur=adresse`);
  }

  if (STATE_REQUIRED_COUNTRIES.includes(country.code) && state === "") {
    redirect(`${back}?erreur=etat`);
  }

  const unpaid = await prisma.printOrder.count({
    where: { buyerId: user.id, status: "AWAITING_PAYMENT" },
  });
  if (unpaid >= MAX_UNPAID_ORDERS) {
    redirect(`${back}?erreur=limite`);
  }

  const shippingPerCopy = getShippingTariffs()[country.zone];
  if (shippingPerCopy === null) {
    redirect(`${back}?erreur=pays`);
  }

  const decision = decideFulfilmentRoute(country.code);
  if (decision.route === "BLOCKED_ADDRESS") {
    redirect(`${back}?erreur=pays`);
  }

  const authorCopy = product.seller.userId === user.id;
  const totals = computePrintTotals({
    retailXof: edition.retailPriceXof,
    printCostXof: edition.printCostXof,
    quantity,
    shippingPerCopyXof: shippingPerCopy,
    authorCopy,
  });

  let createdNumber: string | null = null;

  for (let attempt = 0; attempt < 3 && !createdNumber; attempt += 1) {
    const number = generatePrintOrderNumber();

    try {
      await prisma.printOrder.create({
        data: {
          number,
          buyerId: user.id,
          buyerEmail: user.email,
          productId: product.id,
          sellerId: product.sellerId,
          productTitle: product.title,
          isAuthorCopy: authorCopy,
          quantity,
          unitPriceXof: totals.unitPriceXof,
          printCostXof: edition.printCostXof,
          shippingXof: totals.shippingXof,
          totalXof: totals.totalXof,
          authorNetXof: totals.authorNetXof,
          shipName: name,
          shipStreet1: street1,
          shipStreet2: street2 === "" ? null : street2,
          shipCity: city,
          shipState: state === "" ? null : state,
          shipPostcode: postcode,
          shipCountry: country.code,
          shipPhone: phone,
          route: decision.route,
        },
      });

      createdNumber = number;
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

      if (!isConflict) {
        console.error("Création de la commande imprimée impossible :", error);
        redirect(`${back}?erreur=technique`);
      }
    }
  }

  if (!createdNumber) {
    redirect(`${back}?erreur=technique`);
  }

  redirect(`/acheteur/impression/${createdNumber}`);
          }
