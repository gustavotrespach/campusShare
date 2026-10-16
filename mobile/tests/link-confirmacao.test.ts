import { lerLinkDeConfirmacao } from '@/utils/link-confirmacao';

describe('lerLinkDeConfirmacao', () => {
  it('lê a sessão do fragmento (app instalado)', () => {
    const url =
      'campusshare://confirmacao#access_token=eyJ.abc.def&expires_at=1792101685&expires_in=3600' +
      '&refresh_token=r3fr35h&sb=&token_type=bearer&type=signup';

    expect(lerLinkDeConfirmacao(url)).toEqual({
      tipo: 'sessao',
      accessToken: 'eyJ.abc.def',
      refreshToken: 'r3fr35h',
    });
  });

  it('lê a sessão no formato do Expo Go (exp://host:8081/--/confirmacao#...)', () => {
    const url =
      'exp://Gustavos-MacBook-Pro.local:8081/--/confirmacao#access_token=tok&refresh_token=ref&type=signup';

    expect(lerLinkDeConfirmacao(url)).toMatchObject({ tipo: 'sessao', accessToken: 'tok' });
  });

  it('lê o erro de link expirado ou já usado (formato real do Auth)', () => {
    const url =
      'campusshare:#error=access_denied&error_code=otp_expired' +
      '&error_description=Email+link+is+invalid+or+has+expired&sb=';

    expect(lerLinkDeConfirmacao(url)).toEqual({
      tipo: 'erro',
      codigo: 'otp_expired',
      descricao: 'Email link is invalid or has expired',
    });
  });

  it('aceita o erro na query string e decodifica %XX', () => {
    expect(
      lerLinkDeConfirmacao(
        'campusshare://confirmacao?error=server_error&error_description=Falha%20X',
      ),
    ).toEqual({ tipo: 'erro', codigo: 'server_error', descricao: 'Falha X' });
  });

  it.each([
    'campusshare://confirmacao',
    'campusshare://confirmacao#type=signup',
    'campusshare://confirmacao#access_token=so-o-access',
  ])('link sem sessão nem erro (%p) devolve null', (url) => {
    expect(lerLinkDeConfirmacao(url)).toBeNull();
  });
});
