<script>
	// Logo de Blondel (dessin de l'utilisateur, 2026-10-19 ; source : `static/assets/logo.svg`
	// de Blondel), en ligne pour suivre le thème : fond blanc retiré, recadré sur les marches,
	// faces noires en `currentColor` (encre du thème, sinon invisibles sur fond sombre). Les
	// faces vertes gardent leurs dégradés ; ids uniques par instance (`$props.id`, stable entre
	// le rendu serveur et l'hydratation, Svelte >= 5.20).
	let { size = 24 } = $props();
	const uid = $props.id();
</script>

<svg viewBox="0 0 1175 1175" width={size} height={size} aria-hidden="true" class="blondel-logo">
	<defs>
		<linearGradient id="{uid}-g1" gradientUnits="userSpaceOnUse" x1="397" y1="631" x2="609" y2="543">
			<stop offset="0" stop-color="#105d41" /><stop offset="1" stop-color="#10815b" />
		</linearGradient>
		<linearGradient id="{uid}-g2" gradientUnits="userSpaceOnUse" x1="558" y1="409" x2="772" y2="317">
			<stop offset="0" stop-color="#107451" /><stop offset="1" stop-color="#0e8c64" />
		</linearGradient>
		<linearGradient id="{uid}-g3" gradientUnits="userSpaceOnUse" x1="399" y1="1115" x2="607" y2="963">
			<stop offset="0" stop-color="#0b3c2b" /><stop offset="1" stop-color="#115d43" />
		</linearGradient>
		<linearGradient id="{uid}-g4" gradientUnits="userSpaceOnUse" x1="724" y1="667" x2="932" y2="510">
			<stop offset="0" stop-color="#0f7652" /><stop offset="1" stop-color="#108e65" />
		</linearGradient>
		<linearGradient id="{uid}-g5" gradientUnits="userSpaceOnUse" x1="233" y1="880" x2="446" y2="744">
			<stop offset="0" stop-color="#0e4834" /><stop offset="1" stop-color="#126a4c" />
		</linearGradient>
	</defs>
	<path fill="currentColor" d="M257 925C276 934 298 944 318 952C352 968 387 983 421 999C423 1009 422 1026 422 1036L422 1095C422 1106 423 1143 422 1152C415 1150 408 1146 401 1143C352 1122 305 1100 256 1079C256 1028 256 976 257 925z" />
	<path fill="url(#{uid}-g5)" d="M257 772C263 771 289 759 295 757C323 744 350 732 378 720C390 714 403 708 415 702C420 700 421 701 424 703C422 710 424 835 424 853C406 858 388 868 370 875C334 891 294 911 257 924C258 875 257 822 257 772z" />
	<path fill="#10966b" d="M909 322C955 298 1008 279 1054 255C1060 252 1069 248 1076 246C1075 296 1075 346 1075 396L955 454C948 457 914 473 910 476L908 477L909 475C910 471 909 433 909 427L910 360C910 349 910 332 909 322z" />
	<path fill="#10966b" d="M746 95C766 88 795 74 816 65C848 51 880 37 912 23C912 73 912 123 912 173C896 179 877 188 861 196L789 231C784 233 748 251 746 250C748 245 746 113 746 95z" />
	<path fill="currentColor" d="M583 25C599 32 617 39 634 46L746 95C746 113 748 245 746 250C693 225 636 202 583 177C582 158 583 137 583 118C583 87 583 56 583 25z" />
	<path fill="url(#{uid}-g4)" d="M908 477L910 476C913 485 910 612 911 629L791 682C783 685 752 700 747 701L745 701L745 700C749 690 745 572 746 549C752 548 764 542 770 539L808 522L865 497C879 491 896 484 908 477z" />
	<path fill="#0f7250" d="M745 701L747 701L746 853L628 905C620 909 588 923 584 926L582 926L583 924C584 920 583 880 583 872L583 772L685 727C704 719 726 708 745 701z" />
	<path fill="url(#{uid}-g3)" d="M582 926L584 926C585 935 584 966 584 977L584 1080C551 1096 512 1111 478 1127C469 1131 428 1151 422 1152C423 1143 422 1106 422 1095L422 1036C422 1026 423 1009 421 999C426 998 433 995 437 993C485 969 535 950 582 926z" />
	<path fill="url(#{uid}-g2)" d="M583 323C636 302 694 275 747 252C749 284 747 319 748 351C748 359 749 396 748 402C712 418 676 434 640 450C631 454 592 473 585 475L583 474C585 470 584 333 583 323z" />
	<path fill="url(#{uid}-g1)" d="M421 548C430 546 463 531 473 527C497 516 522 505 546 494C554 490 578 477 584 477C586 504 584 538 585 566C585 579 586 615 585 627C562 633 430 700 421 698C423 692 422 564 421 548z" />
	<path fill="currentColor" d="M747 252C761 259 777 265 791 271L845 295C861 302 893 317 909 322C910 332 910 349 910 360L909 427C909 433 910 471 909 475C899 472 866 456 855 451C821 435 781 419 748 402C749 396 748 359 748 351C747 319 749 284 747 252z" />
	<path fill="currentColor" d="M584 477C622 496 667 513 706 531C713 535 742 547 746 549C745 572 749 690 745 700C720 689 693 677 668 665C641 653 611 641 585 627C586 615 585 579 585 566C584 538 586 504 584 477z" />
	<path fill="currentColor" d="M259 476C313 500 367 525 421 548C422 564 423 692 421 698L259 625C259 576 259 526 259 476z" />
	<path fill="currentColor" d="M423 252C431 255 440 259 449 263C493 284 539 302 583 323C584 333 585 470 583 474C530 450 475 426 423 401L423 252z" />
	<path fill="currentColor" d="M424 853C424 835 422 710 424 703C477 725 530 750 583 772L583 872C583 880 584 920 583 924C565 917 539 905 521 897L424 853z" />
	<path fill="currentColor" d="M99 703C152 725 205 749 257 772C257 822 258 875 257 924C207 901 150 874 99 853L99 703z" />
</svg>

<style>
	.blondel-logo {
		display: block;
		flex: none;
	}
</style>
