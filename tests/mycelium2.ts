import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { Mycelium2 } from "../target/types/mycelium2";

describe("mycelium2", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.Mycelium2 as Program<Mycelium2>;
  const [globalAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId,
  );
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("auth")],
    program.programId,
  );
  const [mint] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId,
  );
  it("Is initialized!", async () => {
    // Add your test here.
    await program.methods.initialize().accounts({
      signer: wallet.publicKey,
      mint,
      globalAccount,
      programAuthority,
    }).rpc();
    const globalAccountData = await program.account.globalAccount.fetch(globalAccount);
    assert(globalAccountData.state === 0, "state not 0")
  });
  it("updates state", async () => {
    const globalAccountDataBefore = await program.account.globalAccount.fetch(globalAccount);
    assert(globalAccountDataBefore.state == 0, "state not 0");
    await program.methods.updateState().accounts({
      signer: wallet.publicKey,
      globalAccount
    }).rpc();
    const globalAccountData = await program.account.globalAccount.fetch(globalAccount);
    assert(globalAccountData.miners.toNumber() == 0, "Miners not 0");
    assert(globalAccountData.state === 1, "state not 1");
  });
  it("mines", async () => {
    for (let i = 0; i < 10; i++) {
      const globalAccountData = await program.account.globalAccount.fetch(globalAccount);
      assert(globalAccountData.miners.toNumber() === i, "incorrect amount of miners");
      const keypair = Keypair.generate();
      await provider.connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const [mineAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("mine"), keypair.publicKey.toBuffer()],
        program.programId
      );
      await program.methods.mine().accounts({
        signer: keypair.publicKey,
        mineAccount,
        globalAccount,
      }).signers([keypair]).rpc();
    }
    const [mineAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("mine"), wallet.publicKey.toBuffer()],
      program.programId
    );
    await program.methods.mine().accounts({
      signer: wallet.publicKey,
      mineAccount,
      globalAccount
    }).rpc();
  });
  it("fails when try to mine twice", async () => {
    const keypair = Keypair.generate();
    await provider.connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const [mineAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("mine"), keypair.publicKey.toBuffer()],
      program.programId
    )
    await program.methods.mine().accounts({
      signer: keypair.publicKey,
      mineAccount,
      globalAccount,
    }).signers([keypair]).rpc();    
    try {
      await program.methods.mine().accounts({
        signer: keypair.publicKey,
        mineAccount,
        globalAccount,
      }).signers([keypair]).rpc();
      throw new Error("Mined successfully")
    } catch (e) {
      assert(e.message !== "Mined successfully");
    }
  });
  it("fails to claim in mine state", async () => {
    try {
      const [mineAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("mine"), wallet.publicKey.toBuffer()],
        program.programId
      );
      const userTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      await program.methods.claim().accounts({
        signer: wallet.publicKey,
        mineAccount,
        globalAccount,
        mint,
        userTokenAccount,
        programAuthority
      }).rpc();
      throw new Error("Claimed successfully")
    } catch (e) {
      assert(e.message !== "Claimed successfully");
    }
  })
  it("moves to claim state", async () =>{
    await program.methods.updateState().accounts({
      signer: wallet.publicKey,
      globalAccount,
    }).rpc();
    const globalAccountData = await program.account.globalAccount.fetch(globalAccount);
    assert(globalAccountData.state == 2, "Not in claim state");
  })
  it("fails to mine in claim state", async () => {
    try {
      const keypair = Keypair.generate();
      await provider.connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const [mineAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("mine"), keypair.publicKey.toBuffer()],
        program.programId
      )
      await program.methods.mine().accounts({
        signer: keypair.publicKey,
        mineAccount,
        globalAccount,
      }).signers([keypair]).rpc();  
      throw new Error("Mined successfully")
    } catch (e) {
      assert(e.message !== "Mined successfully");
    }
  });
  it("claims", async () => {
    const [mineAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("mine"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const userTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
    await program.methods.claim().accounts({
      signer: wallet.publicKey,
      mineAccount,
      globalAccount,
      mint,
      userTokenAccount,
      programAuthority
    }).rpc();
  });
});
