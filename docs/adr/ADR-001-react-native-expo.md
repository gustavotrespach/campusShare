# ADR-001: React Native + Expo no app

## Status
Aceito

## Data
2026-09-17

## Contexto
O app precisa rodar em Android e iOS, e o squad tem três pessoas e cerca de cinco semanas até a AP2. Manter dois códigos nativos é inviável.

## Decisão
Usar **React Native com Expo**, em **TypeScript**, com Expo Router para navegação.

## Alternativas consideradas
- **Flutter** — o squad não domina Dart; curva de aprendizado no prazo.
- **Nativo (Kotlin + Swift)** — duas bases de código.
- **PWA** — limita push no iOS e a experiência de app instalado.

## Consequências
- Positivo: uma base de código para as duas plataformas; o squad já conhece React e TypeScript; Expo Go permite testar em celular real sem Android Studio ou Xcode; EAS Build gera os instaláveis da demo.
- Positivo: TypeScript compartilhado com as Edge Functions do backend (ADR-009).
- Negativo: bibliotecas nativas fora do ecossistema Expo exigem development build.
- Negativo: builds iOS pelo EAS no plano gratuito têm fila e limite mensal.
