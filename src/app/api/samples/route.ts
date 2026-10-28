import { NextResponse } from "next/server";
import { sampleFloorplans, sampleStyleImages } from "@/lib/samples";

/** 内置标准户型图库：支持用户下载 / 一键加载 */
export async function GET() {
  return NextResponse.json({
    floorplans: sampleFloorplans,
    styleImages: sampleStyleImages,
  });
}
