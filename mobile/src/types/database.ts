
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "carona": {
                  Row: {
                    "custo_estimado": number | null,"custo_total": number,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"distancia_km": number | null,"id_carona": string,"id_motorista": string,"id_veiculo": string,"origem": string,"origem_lat": number,"origem_lng": number,"somente_mulheres": boolean,"status": Database["public"]['Enums']["status_carona"],"tolerancia_min": number,"vagas_disponiveis": number,"vagas_ofertadas": number
                  }
                  Insert: {
                    "custo_estimado"?: number | null,"custo_total": number,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"distancia_km"?: number | null,"id_carona"?: string,"id_motorista": string,"id_veiculo": string,"origem": string,"origem_lat": number,"origem_lng": number,"somente_mulheres"?: boolean,"status"?: Database["public"]['Enums']["status_carona"],"tolerancia_min": number,"vagas_disponiveis": number,"vagas_ofertadas": number
                  }
                  Update: {
                    "custo_estimado"?: number | null,"custo_total"?: number,"data_hora_partida"?: string,"destino"?: string,"destino_lat"?: number,"destino_lng"?: number,"distancia_km"?: number | null,"id_carona"?: string,"id_motorista"?: string,"id_veiculo"?: string,"origem"?: string,"origem_lat"?: number,"origem_lng"?: number,"somente_mulheres"?: boolean,"status"?: Database["public"]['Enums']["status_carona"],"tolerancia_min"?: number,"vagas_disponiveis"?: number,"vagas_ofertadas"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "carona_id_motorista_fkey"
      columns: ["id_motorista"]
isOneToOne: false
      referencedRelation: "usuario"
      referencedColumns: ["id_usuario"]
    },{
      foreignKeyName: "carona_veiculo_do_motorista_fkey"
      columns: ["id_veiculo","id_motorista"]
isOneToOne: false
      referencedRelation: "veiculo"
      referencedColumns: ["id_veiculo","id_motorista"]
    }
                  ]
                },"instituicao": {
                  Row: {
                    "dominio_email": string,"id_instituicao": number,"nome": string
                  }
                  Insert: {
                    "dominio_email": string,"id_instituicao"?: never,"nome": string
                  }
                  Update: {
                    "dominio_email"?: string,"id_instituicao"?: never,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pagamento": {
                  Row: {
                    "id_externo": string | null,"id_pagamento": string,"id_reserva": string,"metodo": Database["public"]['Enums']["metodo_pagamento"],"pago_em": string | null,"status": Database["public"]['Enums']["status_pagamento"],"taxa_plataforma": number,"valor": number,"valor_repassado": number
                  }
                  Insert: {
                    "id_externo"?: string | null,"id_pagamento"?: string,"id_reserva": string,"metodo"?: Database["public"]['Enums']["metodo_pagamento"],"pago_em"?: string | null,"status"?: Database["public"]['Enums']["status_pagamento"],"taxa_plataforma": number,"valor": number,"valor_repassado": number
                  }
                  Update: {
                    "id_externo"?: string | null,"id_pagamento"?: string,"id_reserva"?: string,"metodo"?: Database["public"]['Enums']["metodo_pagamento"],"pago_em"?: string | null,"status"?: Database["public"]['Enums']["status_pagamento"],"taxa_plataforma"?: number,"valor"?: number,"valor_repassado"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagamento_id_reserva_fkey"
      columns: ["id_reserva"]
isOneToOne: true
      referencedRelation: "reserva"
      referencedColumns: ["id_reserva"]
    }
                  ]
                },"parametro_custo": {
                  Row: {
                    "atualizado_em": string,"id_parametro": number,"percentual_taxa": number,"preco_litro": number
                  }
                  Insert: {
                    "atualizado_em"?: string,"id_parametro"?: never,"percentual_taxa": number,"preco_litro": number
                  }
                  Update: {
                    "atualizado_em"?: string,"id_parametro"?: never,"percentual_taxa"?: number,"preco_litro"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reserva": {
                  Row: {
                    "criado_em": string,"id_carona": string,"id_passageiro": string,"id_reserva": string,"status": Database["public"]['Enums']["status_reserva"],"valor_individual": number
                  }
                  Insert: {
                    "criado_em"?: string,"id_carona": string,"id_passageiro": string,"id_reserva"?: string,"status"?: Database["public"]['Enums']["status_reserva"],"valor_individual": number
                  }
                  Update: {
                    "criado_em"?: string,"id_carona"?: string,"id_passageiro"?: string,"id_reserva"?: string,"status"?: Database["public"]['Enums']["status_reserva"],"valor_individual"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reserva_id_carona_fkey"
      columns: ["id_carona"]
isOneToOne: false
      referencedRelation: "carona"
      referencedColumns: ["id_carona"]
    },{
      foreignKeyName: "reserva_id_passageiro_fkey"
      columns: ["id_passageiro"]
isOneToOne: false
      referencedRelation: "usuario"
      referencedColumns: ["id_usuario"]
    }
                  ]
                },"usuario": {
                  Row: {
                    "criado_em": string,"email_institucional": string,"expo_push_token": string | null,"genero": Database["public"]['Enums']["genero_usuario"],"id_instituicao": number,"id_usuario": string,"nome_completo": string,"telefone": string | null
                  }
                  Insert: {
                    "criado_em"?: string,"email_institucional": string,"expo_push_token"?: string | null,"genero"?: Database["public"]['Enums']["genero_usuario"],"id_instituicao": number,"id_usuario": string,"nome_completo": string,"telefone"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"email_institucional"?: string,"expo_push_token"?: string | null,"genero"?: Database["public"]['Enums']["genero_usuario"],"id_instituicao"?: number,"id_usuario"?: string,"nome_completo"?: string,"telefone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_id_instituicao_fkey"
      columns: ["id_instituicao"]
isOneToOne: false
      referencedRelation: "instituicao"
      referencedColumns: ["id_instituicao"]
    }
                  ]
                },"veiculo": {
                  Row: {
                    "consumo_kml": number | null,"cor": string,"id_motorista": string,"id_veiculo": string,"modelo": string,"motorizacao": string | null,"placa": string,"qtd_lugares": number
                  }
                  Insert: {
                    "consumo_kml"?: number | null,"cor": string,"id_motorista"?: string,"id_veiculo"?: string,"modelo": string,"motorizacao"?: string | null,"placa": string,"qtd_lugares": number
                  }
                  Update: {
                    "consumo_kml"?: number | null,"cor"?: string,"id_motorista"?: string,"id_veiculo"?: string,"modelo"?: string,"motorizacao"?: string | null,"placa"?: string,"qtd_lugares"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "veiculo_id_motorista_fkey"
      columns: ["id_motorista"]
isOneToOne: false
      referencedRelation: "usuario"
      referencedColumns: ["id_usuario"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "buscar_caronas":
{ Args: { "p_data"?: string,"p_lat": number,"p_lng": number,"p_pagina"?: number,"p_raio_km"?: number,"p_somente_mulheres"?: boolean }; Returns: {
              "cor": string,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"distancia_km": number,"id_carona": string,"modelo": string,"nome_motorista": string,"origem": string,"origem_lat": number,"origem_lng": number,"somente_mulheres": boolean,"tolerancia_min": number,"vagas_disponiveis": number,"valor_por_passageiro": number
            }[]
                           },
"confirmar_pagamento":
{ Args: { "p_id_externo": string,"p_id_pagamento": string,"p_valor": number }; Returns: string
                           },
"desfazer_reserva_sem_cobranca":
{ Args: { "p_id_reserva": string }; Returns: boolean
                           },
"detalhar_carona":
{ Args: { "p_id_carona": string }; Returns: {
              "cor": string,"custo_total": number,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"id_carona": string,"modelo": string,"nome_motorista": string,"origem": string,"origem_lat": number,"origem_lng": number,"placa": string,"somente_mulheres": boolean,"sou_motorista": boolean,"status": Database["public"]['Enums']["status_carona"],"tolerancia_min": number,"vagas_disponiveis": number,"vagas_ofertadas": number,"valor_por_passageiro": number
            }[]
                           },
"minhas_reservas":
{ Args: Record<PropertyKey, never>; Returns: {
              "data_hora_partida": string,"destino": string,"id_carona": string,"id_reserva": string,"nome_motorista": string,"origem": string,"reservado_em": string,"status_carona": Database["public"]['Enums']["status_carona"],"status_pagamento": Database["public"]['Enums']["status_pagamento"],"status_reserva": Database["public"]['Enums']["status_reserva"],"valor": number
            }[]
                           },
"publicar_carona":
{ Args: { "p_custo_total": number,"p_data_hora_partida": string,"p_destino": string,"p_destino_lat": number,"p_destino_lng": number,"p_id_veiculo": string,"p_origem": string,"p_origem_lat": number,"p_origem_lng": number,"p_somente_mulheres"?: boolean,"p_tolerancia_min": number,"p_vagas_ofertadas": number }; Returns: string
                           },
"registrar_cobranca":
{ Args: { "p_id_externo": string,"p_id_pagamento": string }; Returns: undefined
                           },
"reservar_vaga":
{ Args: { "p_id_carona": string,"p_id_passageiro": string }; Returns: {
              "id_pagamento": string,"id_reserva": string,"status": Database["public"]['Enums']["status_reserva"],"taxa_plataforma": number,"valor_individual": number,"valor_repassado": number
            }[]
                           },
"validar_dominio_institucional":
{ Args: { "event": Json }; Returns: Json
                           },
"valor_por_passageiro":
{ Args: { "p_custo_total": number,"p_vagas_ofertadas": number }; Returns: number
                           }
          }
          Enums: {
            "genero_usuario": "FEMININO"|"MASCULINO"|"OUTRO"|"NAO_INFORMADO","metodo_pagamento": "PIX","status_carona": "ABERTA"|"LOTADA"|"CANCELADA"|"CONCLUIDA","status_pagamento": "PENDENTE"|"APROVADO"|"RECUSADO"|"REEMBOLSO_PENDENTE","status_reserva": "PENDENTE"|"CONFIRMADA"|"CANCELADA"|"EXPIRADA"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "genero_usuario": ["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"],"metodo_pagamento": ["PIX"],"status_carona": ["ABERTA", "LOTADA", "CANCELADA", "CONCLUIDA"],"status_pagamento": ["PENDENTE", "APROVADO", "RECUSADO", "REEMBOLSO_PENDENTE"],"status_reserva": ["PENDENTE", "CONFIRMADA", "CANCELADA", "EXPIRADA"]
          }
        }
} as const
