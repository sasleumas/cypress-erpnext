describe('RF006 - Pedidos de Compra', () => {
    beforeEach(() => {
        cy.login_api(); //Login com administrador padrão
    });

    it('CT006-01: Fluxo de compra com fornecedor selecionado', () => {
        // Requisição de Material
        cy.visit('http://localhost:8080/app/material-request/new');
        cy.get('.title-text').should('contain', 'Novo(a) Requisição de Material');

        cy.set_field('schedule_date', '2025-12-31');
        cy.set_child_row('items', { 'item_code': 'SKU002', 'qty': 50 }, 0);
        cy.save_doc();
        cy.get('.indicator-pill').should('contain', 'Rascunho');
        cy.submit_doc();
        cy.get('.indicator-pill').should('contain', 'Pendente');

        // Pedido de Compra (Purchase Order)
        cy.visit('http://localhost:8080/app/purchase-order/new');
        cy.get('.title-text').should('contain', 'Novo(a) Pedido de Compra');

        cy.set_field('supplier', 'Summit Traders Ltd.');
        cy.set_field('schedule_date', '2025-12-31');
        
        // Adiciona item
        cy.set_child_row('items', { 
            'item_code': 'SKU002', 
            'qty': 50,
            'schedule_date': '2025-12-31'
        }, 0);

        cy.save_doc();
        cy.get('.indicator-pill').should('contain', 'Rascunho');
        
        // Submeter
        cy.submit_doc();
        cy.get('.indicator-pill').should('contain', 'Para Receber e Faturar');

        cy.screenshot('CT006-01-requisicao-pedido-compra-salvo-com-sucesso');
    });

    it('CT006-02: Pedido de Compra a partir de Requisição Aprovada', () => {
        //Ter uma Requisição de Material Aprovada
        const reqData = {
                material_request_type: 'Purchase',
                transaction_date: '2025-01-01',
                schedule_date: '2025-12-31',
                company: 'SS Empreendimentos',
                items: [{ 
                    item_code: 'SKU002', 
                    qty: 100, 
                    schedule_date: '2025-12-31',
                    uom: 'Nos',
                    warehouse: 'Lojas - DVV',
                    description: 'Item Teste'
                }],
                docstatus: 1 // 1 = Submetido
            };
        
        cy.create_doc('Material Request', reqData).then((mrDoc) => {
            // Ir para a Requisição e Criar Pedido
            cy.visit(`http://localhost:8080/app/material-request/${mrDoc.name}`);
            cy.get('.title-text').should('contain', 'Laptop');
            // Simula clicar em "Criar > Pedido de Compra"
            cy.create_mapped_doc(
                'erpnext.stock.doctype.material_request.material_request.make_purchase_order',
                mrDoc.name
            );
        });

        // Inserir Fornecedor
        cy.get('.title-text', { timeout: 10000 }).should('contain', 'Novo(a) Pedido de Compra');
        cy.set_field('supplier', 'Summit Traders Ltd.');

        // Valida que os itens vieram da requisição
        cy.window().then((win) => {
            const item = win.cur_frm.doc.items[0];
            expect(item.item_code).to.eq('SKU002');
            expect(item.qty).to.eq(100);
        });

        // Salvar e Submeter
        cy.save_doc();
        cy.submit_doc();

        // - Pedido criado
        cy.get('.indicator-pill').should('satisfy', (el) => 
            el.text().includes('To Receive') || el.text().includes('Para Receber') || el.text().includes('Ordered')
        );

        // Status da Requisição original deve atualizar para 'Ordered' (Pedido)
        cy.window().then((win) => {
            // Pega o nome da Requisição de origem através do link no item do Pedido
            const mrLink = win.cur_frm.doc.items[0].material_request;
            return win.frappe.db.get_value('Material Request', mrLink, 'status');
        }).then((r) => {
            // O status deve ser 'Ordered' ou 'Concluído' dependendo da versão
            expect(r.message.status).to.be.oneOf(['Ordered', 'Concluído', 'Recebido']);
        });
        cy.screenshot('CT006-02-pedido-compra-by-requisicao-aprovada');
    });

    it('CT006-03: Fluxo de Rejeição e Novo Ciclo de Cotação', () => {
        // Uma Cotação de Fornecedor Ativa (Submetida)
        //Criar Cotação via API REST
        const quoteData = {
                supplier: 'Summit Traders Ltd.',
                items: [{ item_code: 'SKU002', qty: 50, rate: 10000 }], // Preço alto proposital
                docstatus: 1 // Já nasce Submetida (Aguardando aprovação/decisão)
        };
        cy.create_doc('Supplier Quotation', quoteData).then((sqDoc) => {
            cy.visit(`http://localhost:8080/app/supplier-quotation/${sqDoc.name}`);
            cy.get('.title-text').should('contain', 'Summit');
        });

        // Ação de Rejeição
        // O documento pede para "Marcar como Rejeitada".
        // Isso é feito cancelando o documento.
        cy.cancel_doc(); 

        // Valida status "Cancelled" (Rejeitado)
        cy.get('.indicator-pill').should('satisfy', (el) => 
            el.text().includes('Cancelled') || el.text().includes('Cancelado')
        );

        // Nova cotação
        // O usuário decide pedir uma nova cotação ou corrigir a atual.
        // Clica em "Amend" (Emendar) para criar a revisão.
        cy.window().then((win) => {
            return win.cur_frm.amend_doc();
        });

        // Espera o novo formulário carregar (Ex: SQ-XXXX-1)
        cy.get('.title-text').should('contain', 'Novo(a) Orçamento de Fornecedor');

        // Ajuste de valores (Novo Ciclo)
        // Atualiza o preço para tentar aprovação
        cy.window().then(async (win) => {
            const frm = win.cur_frm;
            const row = frm.doc.items[0];
            
            // Reduz o preço de 10000 para 800
            await win.frappe.model.set_value(row.doctype, row.name, 'rate', 800);
            
            // (Opcional) Adiciona observação de revisão
            frm.set_value('terms', 'Preço renegociado após rejeição inicial.');
        });

        // Finalização
        cy.save_doc();
        
        // O resultado esperado é ter um novo Rascunho pronto para reiniciar o fluxo
        cy.get('.indicator-pill').should('satisfy', (el) => 
            el.text().includes('Draft') || el.text().includes('Rascunho')
        );
        cy.screenshot('CT006-03-fluxo-rejeicao-nova-cotacao');
    });

    it('CT006-04: Validação Fornecedor Obrigatório', () => {
        cy.visit('http://localhost:8080/app/purchase-order/new');
        // Tenta salvar vazio
        cy.get('button[data-label="Salvar"]').click();
        
        // Mensagem de erro do sistema
        cy.get('.modal-title, .desk-alert').should('contain', 'Campos ausentes');
        cy.get('.msgprint').should('contain', 'Fornecedor');

        cy.screenshot('CT006-04-requisicao-pedido-sem-fornecedor');
    });
});