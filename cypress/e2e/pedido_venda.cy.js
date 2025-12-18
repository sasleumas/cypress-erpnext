describe('RF005 - Pedidos de Venda', () => {
  beforeEach(() => {
    cy.login_api(); //Login com administrador padrão
  });

  it('CT005-01: Cadastro de pedido de venda válido e reserva no estoque', () => {

    cy.visit('http://localhost:8080/app/sales-order/new');
    cy.get('.title-text').should('contain', 'Novo(a) Pedido de Venda');

    // Preenchimento
    cy.set_field('customer', 'Mauro Silva');
    cy.set_field('delivery_date', '2025-12-31');

    // Preenche a linha 0 da tabela 'items'
    cy.set_child_row('items', {
        'item_code': 'ITM-0001',
        'qty': 10
    }, 0); // 0 = Primeira linha

    // Salvar
    cy.save_doc();
    cy.get('.indicator-pill').should('contain', 'Rascunho');

    // Submeter (trata modal)
    cy.submit_doc();
    
    // Validação Final
    cy.get('.indicator-pill').should('contain', 'Para Entregar e Faturar');
    cy.screenshot('CT005-01-pedido-venda-salvo-com-sucesso');
  });

  it('CT005-02: Atualização de pedido (Reduzir quantidade)', () => {
    // Pré-condição: Cria um rascunho rápido via API direta para testar edição
    cy.visit('http://localhost:8080/app/sales-order/new');
    cy.set_field('customer', 'Mauro Silva');
    cy.set_field('delivery_date', '2025-12-31');
    cy.set_child_row('items', { 'item_code': 'ITM-0001', 'qty': 10, 'rate': 3 }, 0);
    cy.save_doc();

    // Teste de Edição
    cy.set_child_row('items', { 'qty': 5 }, 0); // Altera só a Qty na linha 0
    
    cy.save_doc();
    
    // Verifica se salvou sem erro
    cy.get('.msgprint').should('not.exist');

    //Valida Status, Quantidade e Valor Total
    cy.window().then((win) => {
        const doc = win.cur_frm.doc;
        const item = doc.items[0];

        // Validação do Status
        expect(doc.status).to.eq('Draft'); 
        cy.get('.indicator-pill').should('contain', 'Rascunho');
        // Validação da Quantidade
        expect(item.qty).to.eq(5);

        // Validação do Valor Total sem impostos
        const valorEsperado = 5 * 3;
        
        expect(doc.net_total).to.eq(valorEsperado);

        cy.log('Valor Validado: ${doc.net_total} (Esperado: ${valorEsperado})');
    });
    cy.screenshot('CT005-02-pedido-venda-alterado-com-sucesso');
  });

  it('CT005-03: Fluxo de exceção - Salvar pedido sem cliente', () => {
    cy.visit('http://localhost:8080/app/sales-order/new');
    
    //A tela não deixa preencher os itens sem especificar o cliente.
    //cy.set_child_row('items', { 'item_code': 'ITM-0001', 'qty': 10, 'rate': 3 }, 0);
    // Tentar salvar sem preencher o cliente
    cy.get('button[data-label="Salvar"]').click();

    // Mensagem de campo obrigatório
    cy.get('.modal-title, .desk-alert').should('contain', 'Campos ausentes');
    cy.get('.msgprint').should('contain', 'Cliente');

    cy.screenshot('CT005-03-salvar-pedido-venda-sem-cliente');
  });

  it('CT005-04: Fluxo de exceção - Estoque Insuficiente', () => {
    cy.visit('http://localhost:8080/app/sales-order/new');
    cy.set_field('customer', 'Mauro Silva');
    cy.set_field('delivery_date', '2025-12-31');

    // Qty absurda
    cy.set_child_row('items', {
        'item_code': 'SKU001',
        'qty': 9999999
    }, 0);

    cy.save_doc();

    cy.get('.indicator-pill').should('contain', 'Rascunho');

    // Validação Final
    // Verifique se o ERPNext salva o rascunho, mas avisa na grid.
    // Validamos se a bolinha laranja/vermelha apareceu na grid
    // O envio para faturamente deve estar desabilitado.
    cy.get('.grid-row .indicator-orange, .grid-row .indicator-red')
      .should('exist')
      .and('contain', 'Sem Estoque');
    
    cy.screenshot('CT005-04-salvar-pedido-estoque-insuficiente');
  });
});