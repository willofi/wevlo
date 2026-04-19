import type {
  IssueState,
  ProjectBoardAccent,
  ProjectBoardColumnConfigDto,
  ProjectBoardConfigDto
} from "@wevlo/contracts";

const defaultBoardColumns: Array<{
  accent: ProjectBoardAccent;
  label: string;
  state: IssueState;
}> = [
  { state: "backlog", label: "Backlog", accent: "slate" },
  { state: "todo", label: "Todo", accent: "blue" },
  { state: "in_progress", label: "In progress", accent: "amber" },
  { state: "done", label: "Done", accent: "teal" },
  { state: "canceled", label: "Canceled", accent: "rose" }
];

export type ProjectBoardConfigRepository = {
  findByProjectId: (projectId: string) => Promise<ProjectBoardConfigDto | null>;
  save: (config: ProjectBoardConfigDto) => Promise<ProjectBoardConfigDto>;
};

export const resolveProjectBoardColumns = (
  columns: ProjectBoardColumnConfigDto[] | undefined
): ProjectBoardColumnConfigDto[] => {
  const inputByState = new Map(columns?.map((column) => [column.state, column]));

  return defaultBoardColumns
    .map((column, index) => {
      const override = inputByState.get(column.state);

      return {
        state: column.state,
        label: override?.label?.trim().length ? override.label.trim() : column.label,
        accent: override?.accent ?? column.accent,
        order: override?.order ?? index
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((column, index) => ({
      ...column,
      order: index
    }));
};

export const buildDefaultProjectBoardConfig = (projectId: string): ProjectBoardConfigDto => ({
  projectId,
  columns: resolveProjectBoardColumns(undefined)
});

export const getProjectBoardConfigUseCase = async (
  repository: ProjectBoardConfigRepository,
  input: {
    projectId: string;
  }
): Promise<ProjectBoardConfigDto> => {
  const stored = await repository.findByProjectId(input.projectId);

  return {
    projectId: input.projectId,
    columns: resolveProjectBoardColumns(stored?.columns)
  };
};

export const updateProjectBoardConfigUseCase = async (
  repository: ProjectBoardConfigRepository,
  input: {
    columns: ProjectBoardColumnConfigDto[];
    projectId: string;
  }
): Promise<ProjectBoardConfigDto> => {
  const normalized = {
    projectId: input.projectId,
    columns: resolveProjectBoardColumns(input.columns)
  } satisfies ProjectBoardConfigDto;

  return repository.save(normalized);
};
