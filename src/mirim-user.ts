export interface MirimUser {
  id: string;
  email: string;
  nickname?: string;
  major?: string;
  isGraduated?: boolean;
  admission?: string;
  role?: string;
  generation?: number;
  grade?: number;
  graduationYear?: number;
}

export function mirimUserFromJson(json: any): MirimUser {
  return {
    id: json.id?.toString() ?? "",
    email: json.email?.toString() ?? "",
    nickname: json.nickname?.toString(),
    major: json.major?.toString(),
    isGraduated:
      typeof json.isGraduated === "boolean" ? json.isGraduated : undefined,
    admission: json.admission?.toString(),
    role: json.role?.toString(),
    generation:
      typeof json.generation === "number" ? json.generation : undefined,
    grade: typeof json.grade === "number" ? json.grade : undefined,
    graduationYear:
      typeof json.graduationYear === "number" ? json.graduationYear : undefined,
  };
}

export function mirimUserToJson(user: MirimUser): any {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    major: user.major,
    isGraduated: user.isGraduated,
    admission: user.admission,
    role: user.role,
    generation: user.generation,
    grade: user.grade,
    graduationYear: user.graduationYear,
  };
}
