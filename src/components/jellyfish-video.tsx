/**
 * Água-viva do site institucional (mesmo vídeo e mesma composição do hero de datagroup.global).
 * Com "reduzir movimento" fica só o poster.
 */
export function JellyfishVideo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_calc(100%-8rem),transparent)]"
    >
      <video
        className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-40 motion-reduce:hidden lg:w-[62%] lg:opacity-80 lg:[mask-image:linear-gradient(90deg,transparent,#000_45%)]"
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="auto"
        poster="/media/jellyfish-poster.jpg"
      >
        <source src="/media/jellyfish-540.mp4" type="video/mp4" media="(max-width: 767px)" />
        <source src="/media/jellyfish-720.mp4" type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/media/jellyfish-poster.jpg"
        alt=""
        className="absolute inset-y-0 right-0 hidden h-full w-full object-cover opacity-60 motion-reduce:block lg:w-[62%] lg:[mask-image:linear-gradient(90deg,transparent,#000_45%)]"
      />
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-jelly-blue/20 blur-[120px]" />
      <div className="absolute inset-0 bg-gradient-to-r from-abyss-deep/80 via-abyss-deep/25 to-transparent lg:from-abyss-deep/60" />
    </div>
  );
}
