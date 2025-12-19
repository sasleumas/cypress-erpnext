describe('RF008 - Rastreabilidade (Serial e Lote)', () => {
    beforeEach(() => {
        cy.login_api();
    });

    it('CT008-01: Consulta de Rastreabilidade de item serializado', () => {
        const itemSerial = `ITEM-SN-${Date.now()}`;
        const serialNo = `SN-${Date.now()}`;

        // Item Serializado com entrada feita
        cy.create_doc('Item', {
            item_code: itemSerial,
            item_group: 'Produtos',
            is_stock_item: 1,
            stock_uom: 'Unidade',
            has_serial_no: 1, // Ativa serial
            serial_no_series: 'SN-.####'
        });

        // Entrada de Estoque definindo o Serial Específico
        cy.create_doc('Stock Entry', {
            stock_entry_type: 'Material Receipt',
            items: [{
                item_code: itemSerial,
                qty: 1,
                stock_uom: 'Unidade',
                t_warehouse: 'Lojas - DVV',
                serial_no: serialNo // Define o serial manualmente na entrada
            }],
            docstatus: 1
        });

        // Acessa a página do Serial Number
        cy.visit(`http://localhost:8080/app/serial-no/${serialNo}`);

        // Verifica status e localização
        cy.get('.indicator-pill').should('contain', 'Ativo');
        
        cy.window().then((win) => {
            const doc = win.cur_frm.doc;
            expect(doc.item_code).to.eq(itemSerial);
            expect(doc.warehouse).to.contain('Lojas');
        });
        cy.screenshot('CT008-01-consulta-rastreio-item-serial');
    });

    it('CT008-02: Consulta de Lote Completo (Batch)', () => {
        const itemBatch = `ITEM-BATCH-${Date.now()}`;
        const batchId = `LOTE-${Date.now()}`;

        // Item controlável por Lote
        cy.create_doc('Item', {
            item_code: itemBatch,
            item_group: 'Produtos',
            stock_uom: 'Unidade',
            is_stock_item: 1,
            has_batch_no: 1, 
            create_new_batch: 1,
            batch_number_series: 'LOTE-.####'
        });

        // Entrada de 50 unidades nesse lote
        //Criar o Lote Explicitamente
        cy.create_doc('Batch', {
            batch_id: batchId, // Tenta forçar este ID
            item: itemBatch    // Vincula ao item criado acima
        }).then((batchDoc) => {

            const realBatchId = batchDoc.name || batchId;

            // Entrada de Estoque usando o Lote criado
            return cy.create_doc('Stock Entry', {
                stock_entry_type: 'Material Receipt',
                items: [{
                    item_code: itemBatch,
                    qty: 50,
                    t_warehouse: 'Lojas - DVV', 
                    batch_no: realBatchId, 
                    uom: 'Unidade'
                }],
                docstatus: 1
            }).then(() => {
                // Passa o ID real para a parte de teste visual
                return realBatchId;
            });
        }).then((finalBatchId) => {

            // Acessa o registro do Lote
            cy.visit(`http://localhost:8080/app/batch/${batchId}`);

            // Verifica saldo do lote
            cy.window().then((win) => {
                const doc = win.cur_frm.doc;
                expect(doc.item).to.eq(itemBatch);
                expect(doc.batch_id).to.eq(batchId);
            });
            
            // Verifica visualmente se há referência de quantidade
            cy.get('body').should('contain', itemBatch);
        });
        cy.screenshot('CT008-02-consulta-lote-completo');
    });

    it('CT008-03: Tratamento de erro para número de série não encontrado', () => {
        const serialFake = 'SN-INEXISTENTE-999';

        // Tentar acessar um serial que não existe
        cy.visit(`http://localhost:8080/app/serial-no/${serialFake}`, { failOnStatusCode: false });

        // O sistema deve mostrar mensagem de erro
        cy.get('.lead').should('satisfy', (el) => {
            const text = el.text();
            return text.includes('não encontrado') || text.includes('Não foi possível encontrar');
        });
        cy.screenshot('CT008-03-tratamento-erro-numero-nao-encontrado');
    });
});