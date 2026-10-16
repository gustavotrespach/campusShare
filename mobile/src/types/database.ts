
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
                    "custo_estimado": number | null,"custo_total": number,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"distancia_km": number | null,"id_carona": string,"id_motorista": string,"id_veiculo": string,"origem": string,"origem_lat": number,"origem_lng": number,"somente_mulheres": boolean,"status": Database["public"]['Enums']["status_carona"],"tolerancia_min": number,"vagas_disponiveis": number
                  }
                  Insert: {
                    "custo_estimado"?: number | null,"custo_total": number,"data_hora_partida": string,"destino": string,"destino_lat": number,"destino_lng": number,"distancia_km"?: number | null,"id_carona"?: string,"id_motorista": string,"id_veiculo": string,"origem": string,"origem_lat": number,"origem_lng": number,"somente_mulheres"?: boolean,"status"?: Database["public"]['Enums']["status_carona"],"tolerancia_min": number,"vagas_disponiveis": number
                  }
                  Update: {
                    "custo_estimado"?: number | null,"custo_total"?: number,"data_hora_partida"?: string,"destino"?: string,"destino_lat"?: number,"destino_lng"?: number,"distancia_km"?: number | null,"id_carona"?: string,"id_motorista"?: string,"id_veiculo"?: string,"origem"?: string,"origem_lat"?: number,"origem_lng"?: number,"somente_mulheres"?: boolean,"status"?: Database["public"]['Enums']["status_carona"],"tolerancia_min"?: number,"vagas_disponiveis"?: number
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
            "validar_dominio_institucional":
{ Args: { "event": Json }; Returns: Json
                           }
          }
          Enums: {
            "genero_usuario": "FEMININO"|"MASCULINO"|"OUTRO"|"NAO_INFORMADO","status_carona": "ABERTA"|"LOTADA"|"CANCELADA"|"CONCLUIDA"
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
            "genero_usuario": ["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"],"status_carona": ["ABERTA", "LOTADA", "CANCELADA", "CONCLUIDA"]
          }
        }
} as const
