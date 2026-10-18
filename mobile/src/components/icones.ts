import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

// Nome de um ícone do Ionicons (docs/design/DESIGN.md: todos os ícones do app são Ionicons)
export type NomeIcone = ComponentProps<typeof Ionicons>['name'];
