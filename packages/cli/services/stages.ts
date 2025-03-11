import { authRequest } from "../utils/auth.js";

export type Stage = {
  id: string;
  name: string;
  order: number;
};

type StagesResponse = {
  stages: Stage[];
};

export async function listStages(appId: string): Promise<Stage[]> {
  const response = await authRequest<StagesResponse>(`/apps/${appId}/stages`);
  return response.stages;
}
