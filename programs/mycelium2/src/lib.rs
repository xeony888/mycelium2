use anchor_lang::prelude::*;

declare_id!("CMLBhrxJKPXr8GEJznTvgj9yiEskNH1anA2UUpQ5kV4G");

#[program]
pub mod mycelium2 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
