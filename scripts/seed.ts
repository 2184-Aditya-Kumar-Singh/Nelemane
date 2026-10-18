import nextEnv from "@next/env";
import mongoose, { type Types } from "mongoose";
import { deflateSync } from "node:zlib";

import { APP_NAME } from "@/config/app";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/server/auth/password";
import { encryptSensitiveValue } from "@/server/security/encryption";
import { connectToDatabase } from "@/server/db/connection";
import { MenuModel, MENU_DAYS, type MenuDay, type MenuRecord } from "@/server/db/models/menu";
import { PaymentModel } from "@/server/db/models/payment";
import { PgModel, type PgAsset, type PgGender, type PgRecord } from "@/server/db/models/pg";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { ReviewModel } from "@/server/db/models/review";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TenantModel } from "@/server/db/models/tenant";
import { TicketModel } from "@/server/db/models/ticket";
import { UserModel } from "@/server/db/models/user";
import { getStorageProvider } from "@/server/providers/storage";
import { dateKeyForMonthDay, getIstMonthKey, istMidnightUtc } from "@/server/payments/dates";
import { deriveChargeStatus } from "@/server/payments/logic";

nextEnv.loadEnvConfig(process.cwd());

type DemoPg = {
  slug: string;
  name: string;
  locality: string;
  pincode: string;
  gender: PgGender;
  ownerName: string;
  ownerPhone: string;
  upiId?: string;
  paymentAccount: "BUSINESS" | "PERSONAL";
  qr: boolean;
  bank?: { holder: string; name: string; number: string; ifsc: string; branch: string };
  accent: string;
  rentWindow: { startDay: number; endDay: number };
};

const demoPgs: DemoPg[] = [
  {
    slug: "indiranagar-garden-house",
    name: "Garden House PG",
    locality: "Indiranagar",
    pincode: "560038",
    gender: "GIRLS",
    ownerName: "Meera Rao",
    ownerPhone: "9876501201",
    upiId: "gardenhouse.demo@upi",
    paymentAccount: "BUSINESS",
    qr: true,
    accent: "#2b6e54",
    rentWindow: { startDay: 1, endDay: 5 },
  },
  {
    slug: "koramangala-courtyard-stay",
    name: "Courtyard Stay",
    locality: "Koramangala",
    pincode: "560034",
    gender: "COED",
    ownerName: "Rohan Shetty",
    ownerPhone: "9876501202",
    upiId: "courtyard.demo@upi",
    paymentAccount: "PERSONAL",
    qr: true,
    accent: "#a45e32",
    rentWindow: { startDay: 3, endDay: 7 },
  },
  {
    slug: "hsr-lakeview-residency",
    name: "Lakeview Residency",
    locality: "HSR Layout",
    pincode: "560102",
    gender: "BOYS",
    ownerName: "Arjun Nair",
    ownerPhone: "9876501203",
    paymentAccount: "BUSINESS",
    qr: false,
    bank: {
      holder: "Arjun Nair",
      name: "Demo Cooperative Bank",
      number: "000000001236",
      ifsc: "DEMO0001234",
      branch: "HSR Layout",
    },
    accent: "#465a9b",
    rentWindow: { startDay: 1, endDay: 6 },
  },
];

function svgPlaceholder(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#fffbf5"/><stop offset="1" stop-color="${accent}" stop-opacity=".55"/></linearGradient></defs><rect width="960" height="640" fill="url(#g)"/><circle cx="765" cy="125" r="84" fill="#f59e0b" fill-opacity=".32"/><path d="M175 560V298l305-206 305 206v262H175Z" fill="#fffaf1" fill-opacity=".92"/><path d="M412 560V370h136v190" fill="${accent}"/><rect x="258" y="355" width="92" height="92" rx="8" fill="${accent}" fill-opacity=".24"/><rect x="610" y="355" width="92" height="92" rx="8" fill="${accent}" fill-opacity=".24"/><text x="480" y="610" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#1e1b4b">${label} · demo photo</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([length, crcInput, checksum]);
}

function demoQrPng(seed: number): Buffer {
  const moduleCount = 29;
  const quietModules = 2;
  const cellSize = 10;
  const size = (moduleCount + quietModules * 2) * cellSize;
  const modules = Array.from({ length: moduleCount }, () => Array<boolean>(moduleCount).fill(false));
  let state = seed >>> 0;
  const nextBit = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state & 0x80000000) !== 0;
  };

  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      modules[y]![x] = nextBit();
    }
  }
  for (const [left, top] of [[0, 0], [moduleCount - 7, 0], [0, moduleCount - 7]]) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const isBorder = x === 0 || y === 0 || x === 6 || y === 6;
        const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        modules[top + y]![left + x] = isBorder || isCenter;
      }
    }
  }

  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(size * rowBytes, 255);
  for (let y = 0; y < size; y += 1) {
    const row = y * rowBytes;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const moduleX = Math.floor(x / cellSize) - quietModules;
      const moduleY = Math.floor(y / cellSize) - quietModules;
      const isBlack = moduleX >= 0 && moduleY >= 0 && moduleX < moduleCount && moduleY < moduleCount && modules[moduleY]![moduleX];
      const pixel = row + 1 + x * 4;
      const value = isBlack ? 20 : 255;
      raw[pixel] = value;
      raw[pixel + 1] = value;
      raw[pixel + 2] = value;
      raw[pixel + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const compressed = deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function seedSuperAdmin(passwordHash: string): Promise<void> {
  const env = getEnv();
  const existingUser = await UserModel.findOne({ email: env.ADMIN_EMAIL })
    .select("role")
    .lean();

  if (existingUser) {
    if (existingUser.role !== "SUPER_ADMIN") {
      throw new Error("The configured administrator email belongs to another role");
    }
    console.info(`${APP_NAME} Super Admin account is already present.`);
    return;
  }

  await UserModel.create({
    role: "SUPER_ADMIN",
    name: "Super Admin",
    email: env.ADMIN_EMAIL,
    passwordHash,
    mustChangePassword: true,
    status: "ACTIVE",
  });
  console.info(`${APP_NAME} Super Admin account created; password change is required at first sign-in.`);
}

async function seedUser(input: {
  email: string;
  name: string;
  phone: string;
  role: "PG_OWNER" | "TENANT";
  pgId: Types.ObjectId;
  id?: Types.ObjectId;
  passwordHash: string;
  profilePhoto: PgAsset;
}): Promise<Types.ObjectId> {
  const existing = await UserModel.findOne({ email: input.email }).select("_id role pgId").lean();
  if (existing && (existing.role !== input.role || existing.pgId?.toString() !== input.pgId.toString())) {
    throw new Error(`The demo email ${input.email} already belongs to another account`);
  }
  const user = await UserModel.findOneAndUpdate(
    { email: input.email },
    {
      $set: {
        role: input.role,
        name: input.name,
        phone: input.phone,
        pgId: input.pgId,
        status: "ACTIVE",
        profilePhoto: input.profilePhoto,
      },
      $setOnInsert: {
        _id: input.id ?? new mongoose.Types.ObjectId(),
        passwordHash: input.passwordHash,
        mustChangePassword: true,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).select("_id").lean();
  if (!user) throw new Error(`Unable to create demo account ${input.email}`);
  return user._id;
}

async function seedDemoPg(config: DemoPg, passwordHash: string, now: Date): Promise<void> {
  const ownerEmail = `owner.${config.slug}@example.invalid`;
  const priorPg = await PgModel.findOne({ slug: config.slug }).lean();
  const priorOwner = await UserModel.findOne({ email: ownerEmail }).select("_id role pgId").lean();
  const pgId = priorPg?._id ?? new mongoose.Types.ObjectId();
  const ownerUserId = priorPg?.ownerUserId ?? priorOwner?._id ?? new mongoose.Types.ObjectId();
  if (priorPg && priorOwner && priorPg.ownerUserId.toString() !== priorOwner._id.toString()) {
    throw new Error(`The demo PG ${config.slug} is linked to a different owner account`);
  }

  const ownerPhoto: PgAsset = { url: svgPlaceholder(config.ownerName, config.accent), publicId: `demo-${config.slug}-owner` };
  const ownerId = await seedUser({
    email: ownerEmail,
    name: config.ownerName,
    phone: config.ownerPhone,
    role: "PG_OWNER",
    pgId,
    id: ownerUserId,
    passwordHash,
    profilePhoto: ownerPhoto,
  });

  let qrImage = priorPg?.paymentDetails.qrImage;
  if (config.qr && !qrImage) {
    const storedQr = await getStorageProvider().upload({
      bytes: demoQrPng(config.slug.length),
      contentType: "image/png",
      resourceType: "image",
      visibility: "private",
      folder: `nelemane/demo/${config.slug}/payment-qr`,
    });
    qrImage = { url: storedQr.url, publicId: storedQr.publicId };
  }

  const bank = config.bank
    ? {
        accountHolderName: config.bank.holder,
        bankName: config.bank.name,
        accountNumber: priorPg?.paymentDetails.bank?.accountNumber ?? encryptSensitiveValue(config.bank.number),
        ifsc: config.bank.ifsc,
        branch: config.bank.branch,
      }
    : undefined;
  const pgPhoto: PgAsset = { url: svgPlaceholder(config.name, config.accent), publicId: `demo-${config.slug}-profile` };
  const gallery = ["Front entrance", "Common lounge", "Sunlit courtyard"].map((caption, index) => ({
    url: svgPlaceholder(`${config.name} · ${caption}`, config.accent),
    publicId: `demo-${config.slug}-gallery-${index + 1}`,
    caption,
  }));
  const paymentDetails: PgRecord["paymentDetails"] = {
    accountType: config.paymentAccount,
    ...(config.upiId ? { upiId: config.upiId } : {}),
    ...(qrImage ? { qrImage } : {}),
    ...(bank ? { bank } : {}),
    instructions: "DEMO LISTING — this sample QR or bank account is not valid for payment.",
  };

  const pg = await PgModel.findOneAndUpdate(
    { slug: config.slug },
    {
      $set: {
        name: config.name,
        slug: config.slug,
        ownerUserId: ownerId,
        owner: { name: config.ownerName, phone: config.ownerPhone, email: ownerEmail },
        nominee: { name: `${config.ownerName.split(" ")[0]} Nominee`, phone: config.ownerPhone, relation: "Sibling" },
        address: { line1: `24 Sample Road, ${config.locality}`, locality: config.locality, city: "Bengaluru", state: "Karnataka", pincode: config.pincode, landmark: "Near the neighbourhood park" },
        profilePhoto: pgPhoto,
        description: `${config.name} is a fictional demo home in ${config.locality}, Bengaluru. Explore its shared rooms, resident menu and sample maintenance tickets. All payment instructions on this demo listing are invalid.`,
        gender: config.gender,
        facilities: ["WiFi", "Hot water", "Laundry", "Meals included", "Housekeeping", "CCTV", "Study room"],
        customFacilities: ["Filter coffee corner"],
        houseRules: "Demo property. Quiet hours begin at 10:00 PM. Keep shared spaces tidy and notify the owner about maintenance issues.",
        photos: gallery,
        paymentDetails,
        rentWindow: config.rentWindow,
        reminder: { enabled: true, everyNDays: 2, email: true, sms: false },
        subscription: { status: "ACTIVE", planLabel: "Demo", startsAt: new Date(now.getTime() - 30 * 86_400_000), endsAt: new Date(now.getTime() + 365 * 86_400_000), notes: "Seeded demonstration listing." },
        isListed: true,
        status: "ACTIVE",
      },
      $setOnInsert: { _id: pgId, ratingAvg: 0, ratingCount: 0 },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();
  if (!pg) throw new Error(`Unable to create demo PG ${config.slug}`);

  const roomTypeDefinitions = [
    { name: "Twin sharing · non-AC", sharing: 2, ac: false, attachedBath: false, rent: 950_000, deposit: 950_000 },
    { name: "Single room · AC", sharing: 1, ac: true, attachedBath: true, rent: 1_850_000, deposit: 1_850_000 },
  ] as const;
  const roomTypes = [];
  for (const [index, definition] of roomTypeDefinitions.entries()) {
    const roomPhoto = svgPlaceholder(`${config.name} · ${definition.name}`, config.accent);
    const roomType = await RoomTypeModel.findOneAndUpdate(
      { pgId: pg._id, name: definition.name },
      {
        $set: {
          pgId: pg._id,
          ...definition,
          description: "A comfortable demo room with natural light and secure storage.",
          amenities: ["Study desk", "Wardrobe", "Filtered water"],
          photos: [
            { url: roomPhoto, publicId: `demo-${config.slug}-room-${index + 1}-1` },
            { url: svgPlaceholder(`${config.name} · room view`, config.accent), publicId: `demo-${config.slug}-room-${index + 1}-2` },
          ],
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    if (!roomType) throw new Error(`Unable to create demo room type for ${config.slug}`);
    roomTypes.push(roomType);
  }

  const rooms = [];
  for (const [index, roomType] of roomTypes.entries()) {
    const room = await RoomModel.findOneAndUpdate(
      { pgId: pg._id, block: "A", roomNumber: index === 0 ? "101" : "201" },
      {
        $set: {
          pgId: pg._id,
          roomTypeId: roomType._id,
          roomNumber: index === 0 ? "101" : "201",
          floor: index === 0 ? "1st floor" : "2nd floor",
          block: "A",
          capacity: index === 0 ? 2 : 1,
          occupiedCount: 1,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    if (!room) throw new Error(`Unable to create demo room for ${config.slug}`);
    rooms.push(room);
  }

  const tenants = [];
  for (const [index, room] of rooms.entries()) {
    const tenantName = index === 0 ? "Asha Menon" : "Kiran Dev";
    const tenantEmail = `tenant.${config.slug}.${index + 1}@example.invalid`;
    const tenantPhone = index === 0 ? "9876501301" : "9876501302";
    const tenantPhoto: PgAsset = { url: svgPlaceholder(tenantName, config.accent), publicId: `demo-${config.slug}-tenant-${index + 1}` };
    const userId = await seedUser({ email: tenantEmail, name: tenantName, phone: tenantPhone, role: "TENANT", pgId: pg._id, passwordHash, profilePhoto: tenantPhoto });
    const tenant = await TenantModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          pgId: pg._id,
          userId,
          roomId: room._id,
          name: tenantName,
          phone: tenantPhone,
          email: tenantEmail,
          parents: { fatherName: index === 0 ? "Ravi Menon" : "Dev Kumar", motherName: index === 0 ? "Latha Menon" : "Anita Dev", phone: index === 0 ? "9876501401" : "9876501402" },
          monthlyRent: roomTypes[index]!.rent,
          deposit: roomTypes[index]!.deposit,
          joinedAt: new Date(now.getTime() - (index + 2) * 30 * 86_400_000),
          profilePhoto: tenantPhoto,
          status: "ACTIVE",
          vacatedAt: undefined,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    if (!tenant) throw new Error(`Unable to create demo tenant ${tenantEmail}`);
    tenants.push(tenant);
  }

  const month = getIstMonthKey(now);
  const monthStart = istMidnightUtc(dateKeyForMonthDay(month, 1));
  for (const [index, tenant] of tenants.entries()) {
    const amount = tenant.monthlyRent;
    const paidAmount = index === 0 ? amount : 0;
    const windowEnd = istMidnightUtc(dateKeyForMonthDay(month, config.rentWindow.endDay));
    const status = deriveChargeStatus({ amount, paidAmount, windowEnd }, false, now);
    const charge = await RentChargeModel.findOneAndUpdate(
      { tenantId: tenant._id, month },
      {
        $set: { pgId: pg._id, tenantId: tenant._id, month, amount, paidAmount, windowStart: monthStart, windowEnd, status, reminderCount: 0 },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    if (!charge) throw new Error(`Unable to create the demo rent charge for ${tenant.email}`);

    const rating = index === 0 ? 5 : 4;
    await ReviewModel.findOneAndUpdate(
      { pgId: pg._id, tenantId: tenant._id },
      { $set: { pgId: pg._id, tenantId: tenant._id, rating, comment: index === 0 ? "A friendly place with a convenient neighbourhood." : "Comfortable rooms and a helpful owner." , editedAt: now } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    if (index === 0) {
      await PaymentModel.findOneAndUpdate(
        { chargeId: charge._id, source: "OWNER", note: "Nelemane demo seed payment — no money was transferred." },
        {
          $set: {
            pgId: pg._id,
            tenantId: tenant._id,
            chargeId: charge._id,
            month,
            source: "OWNER",
            mode: "CASH",
            transactionDate: now,
            amountSubmitted: amount,
            payerName: tenant.name,
            note: "Nelemane demo seed payment — no money was transferred.",
            status: "APPROVED",
            approvedAmount: amount,
            reviewedBy: ownerId,
            reviewedAt: now,
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true },
      );
    }
  }

  const mondayMenu: MenuRecord["week"][MenuDay] = {
    breakfast: { items: ["Idli", "Coconut chutney", "Filter coffee"], isVeg: true },
    lunch: { items: ["Rice", "Sambar", "Poriyal", "Curd"], isVeg: true },
    snacks: { items: ["Masala chai", "Banana"], isVeg: true },
    dinner: { items: ["Chapati", "Paneer curry", "Salad"], isVeg: true },
  };
  const week = Object.fromEntries(MENU_DAYS.map((day, index) => [
    day,
    {
      breakfast: { ...mondayMenu.breakfast, items: index === 0 ? mondayMenu.breakfast.items : ["Dosa", "Sambar", "Filter coffee"] },
      lunch: { ...mondayMenu.lunch, items: index === 0 ? mondayMenu.lunch.items : ["Rice", "Dal", "Seasonal vegetables", "Curd"] },
      snacks: { ...mondayMenu.snacks, items: index === 0 ? mondayMenu.snacks.items : ["Masala chai", "Fruit"] },
      dinner: { ...mondayMenu.dinner, items: index === 0 ? mondayMenu.dinner.items : ["Chapati", "Mixed vegetable curry", "Salad"] },
    },
  ])) as MenuRecord["week"];
  await MenuModel.findOneAndUpdate(
    { pgId: pg._id },
    { $set: { pgId: pg._id, week, updatedBy: ownerId } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );

  const ticketSeeds = [
    { tenant: tenants[0]!, room: rooms[0]!, title: "Demo ticket · bathroom tap", status: "OPEN" as const, category: "PLUMBING" as const },
    { tenant: tenants[1]!, room: rooms[1]!, title: "Demo ticket · WiFi coverage", status: "IN_PROGRESS" as const, category: "WIFI" as const },
  ];
  for (const ticket of ticketSeeds) {
    await TicketModel.findOneAndUpdate(
      { pgId: pg._id, title: ticket.title },
      {
        $set: {
          pgId: pg._id,
          tenantId: ticket.tenant._id,
          roomId: ticket.room._id,
          title: ticket.title,
          description: "This is sample maintenance data created by the demo seed. No action is required.",
          category: ticket.category,
          priority: "NORMAL",
          images: [],
          status: ticket.status,
          timeline: [{ at: now, by: ticket.tenant.userId, action: "CREATED", note: "Seeded demo ticket." }],
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
  }

  const ratings = await ReviewModel.find({ pgId: pg._id }).select("rating").lean();
  const ratingAvg = ratings.length ? ratings.reduce((total, review) => total + review.rating, 0) / ratings.length : 0;
  await PgModel.updateOne({ _id: pg._id }, { $set: { ratingAvg, ratingCount: ratings.length } });
  console.info(`${APP_NAME} demo PG ready: ${config.name} (${config.locality})`);
}

async function seedDemoData(passwordHash: string): Promise<void> {
  const now = new Date();
  for (const config of demoPgs) {
    await seedDemoPg(config, passwordHash, now);
  }
  console.info(`${APP_NAME} demo accounts use the configured ADMIN_INITIAL_PASSWORD and require a password change at first sign-in.`);
}

async function seed(): Promise<void> {
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    throw new Error("The development seed cannot run when NODE_ENV=production");
  }
  await connectToDatabase();
  const passwordHash = await hashPassword(env.ADMIN_INITIAL_PASSWORD);
  await seedSuperAdmin(passwordHash);
  await seedDemoData(passwordHash);
}

try {
  await seed();
  process.exitCode = 0;
} catch {
  console.error("Nelemane seed failed. Check the environment and database connectivity.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
