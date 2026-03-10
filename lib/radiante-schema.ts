import { z } from "zod";

const numericRecord = z.record(z.number());

const StateSchema = numericRecord.and(
  z.object({
    oh: z.number(),
    phi: z.number(),
    eta: z.number(),
    xi: z.number(),  // Ξ - Diversidade (entropia de caminhos)
    def: z.number().optional()  // DEF pode estar em state ou signals
  })
);

const PhaseSchema = numericRecord.and(
  z.object({
    dphi: z.number(),
    doh: z.number().optional(),
    deta: z.number().optional(),
    dxi: z.number().optional()
  })
);

const RegimeSchema = z
  .object({
    label: z.string(),
    score: z.number().min(0).max(1).optional()
  })
  .partial({ score: true });

const EventSchema = z.object({
  type: z.string(),
  label: z.string(),
  severity: z.number().min(0).max(1).optional()
});

const SignalsSchema = z
  .object({
    def: z.number().optional(),
    calm: z.number().optional(),
    lam: z.number().optional(),
    turb: z.number().optional()
  })
  .catchall(z.number())
  .optional();

const RawRefSchema = z
  .object({
    id: z.string().optional(),
    source: z.string().optional()
  })
  .catchall(z.any())
  .optional();

const SeriesItemSchema = z.object({
  t: z.number(),
  state: StateSchema,
  phase: PhaseSchema,
  regime: RegimeSchema.optional(),
  signals: SignalsSchema,
  events: z.array(EventSchema).optional(),
  raw_ref: RawRefSchema
});

const LinkSchema = z.object({
  type: z.string(),
  from: z.object({
    domain: z.string(),
    entity_id: z.string()
  }),
  to: z.object({
    domain: z.string(),
    entity_id: z.string()
  }),
  rule: z.string().optional(),
  weight: z.number().optional()
});

export const RadianteV1Schema = z.object({
  schema_version: z.literal("radiante.v1"),
  domain: z.string(),
  run_id: z.string(),
  entity: z.object({
    id: z.string(),
    label: z.string(),
    meta: z.record(z.unknown()).optional()
  }),
  axes: z.object({
    mode_instrument: z.tuple([z.string(), z.string(), z.string()]),
    mode_phase: z.tuple([z.string(), z.string(), z.string()])
  }),
  time: z.object({
    index_name: z.string(),
    start: z.string().optional(),
    step: z.string().optional(),
    units: z.string().optional()
  }),
  series: z.array(SeriesItemSchema).min(1),
  links: z.array(LinkSchema).optional()
});

export type RadianteV1 = z.infer<typeof RadianteV1Schema>;

export function parseRadianteV1(input: unknown): RadianteV1 {
  return RadianteV1Schema.parse(input);
}

