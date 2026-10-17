// Mesmo formato do CHECK veiculo_placa_formato (migration schema_inicial): antiga (ABC1234) ou
// Mercosul (ABC1D23), maiúsculas e sem hífen. Aqui só para dar retorno rápido; quem garante é o banco.
const FORMATO_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

// O usuário digita como está acostumado ("abc-1d23", "ABC 1234"); o banco guarda sem separador.
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validarPlaca(placa: string): string | undefined {
  const valor = normalizarPlaca(placa);
  if (valor.length === 0) {
    return 'Informe a placa.';
  }
  if (!FORMATO_PLACA.test(valor)) {
    return 'Placa inválida. Use o formato ABC1234 ou ABC1D23.';
  }
  return undefined;
}
