use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount, MintTo, mint_to}};

declare_id!("CMLBhrxJKPXr8GEJznTvgj9yiEskNH1anA2UUpQ5kV4G");

const MINE_SECONDS: u64 = 259200;
const CLAIM_SECONDS: u64 = 86400;
const TOTAL_EMISSIONS: u64 = 1000;
#[program]
pub mod mycelium2 {

    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
    pub fn update_state(ctx: Context<UpdateState>) -> Result<()> {
        let global_account = &mut ctx.accounts.global_account;
        let time = Clock::get()?.unix_timestamp as u64;
        if global_account.state == 0 {
            // uninitialized state to mining state
            global_account.miners = 0;
            global_account.epoch_end = time + MINE_SECONDS;
            global_account.state = 1;
        } else if global_account.state == 1 {
            if time < global_account.epoch_end {
                return Err(CustomError::InvalidTime.into())
            }
            global_account.epoch_end = time + CLAIM_SECONDS;
            // mining state to claiming state
            global_account.state = 2;
        } else if global_account.state == 2 {
            if time < global_account.epoch_end {
                return Err(CustomError::InvalidTime.into())
            }
            // claiming state to uninitialized state
            global_account.state = 0;
        }
        Ok(())
    }
    pub fn mine(ctx: Context<Mine>) -> Result<()> {
        if ctx.accounts.global_account.state != 1 {
            return Err(CustomError::InvalidState.into())
        }
        ctx.accounts.global_account.miners += 1;
        Ok(())
    }
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let emissions = TOTAL_EMISSIONS / ctx.accounts.global_account.miners;
        if ctx.accounts.global_account.state != 2 {
            return Err(CustomError::InvalidState.into())
        }
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.program_authority.to_account_info()
                },
                &[&[b"auth", &[ctx.bumps.program_authority]]]
            ),
            emissions,
        )?;
        Ok(())
    }
}
#[error_code]
pub enum CustomError {
    #[msg("Invalid time")]
    InvalidTime,
    #[msg("Invalid state")]
    InvalidState
}
#[account]
pub struct GlobalAccount {
    pub miners: u64,
    pub epoch_end: u64,
    pub state: u8,
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        seeds = [b"mint"],
        bump,
        mint::authority = program_authority,
        mint::decimals = 6,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = signer,
        seeds = [b"global"],
        bump,
        space = 8 + 8 + 8 + 1,
    )]
    pub global_account: Account<'info, GlobalAccount>,
    #[account(
        init,
        payer = signer,
        seeds = [b"auth"],
        bump,
        space = 8,
    )]
    /// CHECK: 
    pub program_authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct UpdateState<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"global"],
        bump,
    )]
    pub global_account: Account<'info, GlobalAccount>,
}

#[account]
pub struct MineAccount {}
#[derive(Accounts)]
pub struct Mine<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        seeds = [b"mine", signer.key().as_ref()],
        bump,
        space = 8,
    )]
    pub mine_account: Account<'info, MineAccount>,
    #[account(
        mut,
        seeds = [b"global"],
        bump,
    )]
    pub global_account: Account<'info, GlobalAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"mine", signer.key().as_ref()],
        bump,
        close = signer,
    )]
    pub mine_account: Account<'info, MineAccount>,
    #[account(
        seeds = [b"global"],
        bump,   
    )]
    pub global_account: Account<'info, GlobalAccount>,
    #[account(
        seeds = [b"mint"],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"auth"],
        bump
    )]
    /// CHECK:
    pub program_authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


