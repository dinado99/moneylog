import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { ImageParseSchema, type ImageParseRequest } from "@/lib/import/image-schema";

export const maxDuration = 120;

const MAX_SCREENS = 10;
const MAX_TILES = 30;

const SYSTEM_PROMPT = `너는 가계부 앱의 거래 추출기다. 사용자가 올린 금융 앱(주로 뱅크샐러드) 화면 캡처에서 개별 거래 내역만 뽑아 구조화한다.

규칙
- 실제 거래 한 건 한 건만 추출한다. 월 합계, 예산, 일별 합계, 광고, 탭/메뉴, 자산 잔액은 거래가 아니다.
- 뱅크샐러드 가계부 목록은 "23일 목요일" 같은 날짜 헤더 아래에 거래가 나열된다. 각 거래 행에는 가맹점/내용, 분류·결제수단·시간 같은 보조 텍스트, 금액이 있다.
- 연/월이 화면에 보이면 그걸 쓰고, 안 보이면 사용자 메시지의 기본 월을 쓴다. 기본 월 기준으로 오늘(today)보다 미래가 되는 날짜는 만들지 않는다.
- 한 캡처가 여러 조각으로 나뉘어 있으면 조각은 위→아래 순서이고 경계가 조금 겹친다. 겹친 부분에 같은 거래가 두 번 보이면 한 번만 넣는다.
- 서로 다른 캡처끼리도 스크롤이 겹쳐 같은 거래(같은 날짜·시간·내용·금액)가 다시 보이면 한 번만 넣는다. 단, 한 화면 안에서 실제로 두 번 결제된 건 둘 다 넣는다.
- amount는 부호 없는 원 단위 정수. 지출은 보통 검은색/"-", 수입은 파란색/"+"로 표시된다. "이체"로 표시되거나 내 계좌 간 이동이면 transfer.
- category는 화면에 표시된 분류를 우선하고, 없으면 가맹점 이름으로 가장 그럴듯한 것을 고른다. 지출 분류: ${EXPENSE_CATEGORIES.map((c) => c.name).join(", ")}. 수입 분류: ${INCOME_CATEGORIES.map((c) => c.name).join(", ")}. 이체는 "이체".
- 글자가 잘리거나 흐려서 금액/날짜를 확신할 수 없는 행은 넣지 말고 note에 적는다.`;

/** 로그인한 사용자만 API 키를 쓸 수 있게 Supabase 액세스 토큰을 검증한다. */
async function isSignedIn(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return false;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && Boolean(data?.claims.sub);
}

function bad(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!(await isSignedIn(request))) return bad(401, "다시 로그인해 주세요.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return bad(500, "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요.");
  }

  let body: ImageParseRequest;
  try {
    body = await request.json();
  } catch {
    return bad(400, "잘못된 요청이에요.");
  }
  const screens = Array.isArray(body.screens) ? body.screens.filter((s) => Array.isArray(s) && s.length) : [];
  const tileCount = screens.reduce((n, s) => n + s.length, 0);
  if (!screens.length) return bad(400, "이미지가 없어요.");
  if (screens.length > MAX_SCREENS || tileCount > MAX_TILES) {
    return bad(400, `한 번에 캡처 ${MAX_SCREENS}장까지 올릴 수 있어요.`);
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  screens.forEach((tiles, i) => {
    content.push({
      type: "text",
      text: tiles.length > 1 ? `캡처 ${i + 1} (위→아래 ${tiles.length}조각)` : `캡처 ${i + 1}`,
    });
    for (const data of tiles) {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    }
  });
  content.push({
    type: "text",
    text: `기본 월: ${body.month}\n오늘: ${body.today}\n위 캡처들에서 거래 내역을 추출해 줘.`,
  });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: betaZodOutputFormat(ImageParseSchema) },
    });

    if (response.stop_reason === "refusal") return bad(422, "이 이미지는 처리할 수 없어요.");
    if (response.stop_reason === "max_tokens") return bad(422, "내역이 너무 많아요. 캡처를 나눠서 올려 주세요.");
    if (!response.parsed_output) return bad(502, "내역을 읽지 못했어요. 다시 시도해 주세요.");
    return Response.json(response.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return bad(500, "서버의 ANTHROPIC_API_KEY 설정을 확인해 주세요.");
    if (err instanceof Anthropic.RateLimitError) return bad(429, "요청이 많아요. 잠시 후 다시 시도해 주세요.");
    if (err instanceof Anthropic.BadRequestError) return bad(400, "이미지를 처리하지 못했어요. 다른 캡처로 시도해 주세요.");
    if (err instanceof Anthropic.APIError) return bad(502, "분석 서버 오류예요. 잠시 후 다시 시도해 주세요.");
    throw err;
  }
}
